import logger from '../logger.js';
import models from '../database/models.js';
import { processCommand } from './commands.js';
import { getAIResponse } from '../ai/openai.js';
import { getMusicPlayer } from '../music/player.js';
import config from '../config.js';
import { getClient, sendAudio } from './client.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { transcribeAudio } from '../voice/stt.js';
import { synthesizeSpeech } from '../voice/tts.js';

const cooldowns = new Map();

function isSpam(userId) {
  const now = Date.now();
  const last = cooldowns.get(userId) || 0;
  if (now - last < 1000) return true;
  cooldowns.set(userId, now);
  return false;
}

function getCommand(text) {
  const match = text.match(/^[!\/\.]([a-z]+)\s*(.*)/i);
  return match ? { command: match[1].toLowerCase(), args: match[2].trim() } : null;
}

export async function handleMessage(sock, msg, io) {
  try {
    const jid = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const pushName = msg.pushName || 'Unknown';
    const userId = jid.replace('@s.whatsapp.net', '');

    if (isSpam(jid)) return;

    models.upsertUser(userId, pushName, pushName);

    if (msg.message.audioMessage) {
      await handleAudioMessage(sock, msg, jid, userId, pushName, io);
      return;
    }

    if (!text) return;

    models.addMessage(userId, 'user', text);

    if (io) io.emit('whatsapp:message', { from: userId, name: pushName, text, timestamp: new Date() });

    const cmd = getCommand(text);

    if (cmd && processCommand[sock]) {
      const handled = await processCommand[sock](sock, jid, cmd.command, cmd.args);
      if (handled) return;
    }

    if (text.toLowerCase().startsWith('!play ') || text.toLowerCase().startsWith('/play ')) {
      const query = text.replace(/^[!\/]play\s+/i, '');
      const player = getMusicPlayer();
      await player.addToQueue(query, userId, io);
      await sock.sendMessage(jid, { text: `⏳ Buscando: ${query}...` });
      return;
    }

    if (['!pause', '/pause', '!stop', '/stop', '!skip', '/skip', '!next', '/next', '!resume', '/resume', '!volume', '/volume'].includes(text.toLowerCase().split(' ')[0])) {
      const player = getMusicPlayer();
      const action = text.toLowerCase().split(' ')[0].replace(/[!\/]/, '');
      const result = await player.control(action, text.split(' ')[1]);
      await sock.sendMessage(jid, { text: result });
      return;
    }

    if (['!queue', '/queue', '!fila', '/fila'].includes(text.toLowerCase().split(' ')[0])) {
      const player = getMusicPlayer();
      const queue = player.getQueueList();
      if (queue.length === 0) {
        await sock.sendMessage(jid, { text: '📭 Fila vazia' });
      } else {
        const list = queue.map((q, i) => `${i + 1}. ${q.title}`).join('\n');
        await sock.sendMessage(jid, { text: `📋 **Fila de reprodução:**\n${list}` });
      }
      return;
    }

    const aiResponse = await getAIResponse(userId, text);
    await sock.sendMessage(jid, { text: aiResponse });
    models.addMessage(userId, 'assistant', aiResponse);

    if (io) io.emit('whatsapp:message', { from: 'bot', name: '🤖 IA', text: aiResponse, timestamp: new Date() });
  } catch (err) {
    logger.error(`Message handler error: ${err.message}`);
  }
}

async function handleAudioMessage(sock, msg, jid, userId, pushName, io) {
  try {
    if (io) io.emit('whatsapp:audio', { from: userId, name: pushName, timestamp: new Date() });
    if (io) io.emit('whatsapp:message', { from: userId, name: pushName, text: '🎤 (áudio)', timestamp: new Date() });

    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger });
    if (!buffer) return;

    if (io) io.emit('whatsapp:processing', { userId, status: 'transcribing' });
    const transcript = await transcribeAudio(buffer);
    if (!transcript) {
      await sock.sendMessage(jid, { text: '🎤 Não consegui entender o áudio. Tente novamente.' });
      return;
    }

    logger.info(`[VOICE] ${userId}: ${transcript}`);
    models.addMessage(userId, 'user', `[ÁUDIO] ${transcript}`);

    const aiResponse = await getAIResponse(userId, transcript);
    models.addMessage(userId, 'assistant', aiResponse);

    const audioResponse = await synthesizeSpeech(aiResponse);
    if (audioResponse) {
      await sendAudio(jid, audioResponse);
    } else {
      await sock.sendMessage(jid, { text: aiResponse });
    }

    if (io) io.emit('whatsapp:message', { from: 'bot', name: '🤖 IA', text: aiResponse, timestamp: new Date() });
    if (io) io.emit('whatsapp:audio', { from: 'bot', userId, timestamp: new Date() });
  } catch (err) {
    logger.error(`Audio handler error: ${err.message}`);
    try {
      await sock.sendMessage(jid, { text: 'Erro ao processar o áudio.' });
    } catch {}
  }
}
