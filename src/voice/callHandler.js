import logger from '../logger.js';
import { transcribeAudio } from './stt.js';
import { synthesizeSpeech } from './tts.js';
import { getAIResponse } from '../ai/openai.js';
import models from '../database/models.js';
import { getClient, sendAudio } from '../whatsapp/client.js';

let activeCalls = new Map();

export async function handleCall(sock, call) {
  try {
    const callerJid = call.from;
    const userId = callerJid.replace('@s.whatsapp.net', '');
    logger.info(`Incoming call from ${userId}`);

    const callId = call.id;
    activeCalls.set(callId, { userId, status: 'answering' });

    await sock.sendMessage(callerJid, {
      text: '📞 Chamada recebida! Estou atendendo... Posso ouvir você, fale após o sinal.',
    });

    models.addMessage(userId, 'system', 'Iniciou uma chamada de voz');
    models.logCall(userId, 'incoming', 0, 'connected');

    setTimeout(() => {
      sock.sendMessage(callerJid, {
        text: '🎙️ Chamada de voz não implementada totalmente neste ambiente.\n\nMas você pode continuar conversando comigo por texto normalmente! Me mande um áudio ou mensagem.',
      }).catch(() => {});
      activeCalls.delete(callId);
    }, 3000);

    return { answered: true, callId };
  } catch (err) {
    logger.error(`Call handler error: ${err.message}`);
    return { answered: false };
  }
}

export async function processCallAudio(callId, audioBuffer, io) {
  try {
    const call = activeCalls.get(callId);
    if (!call) throw new Error('Call not found');

    if (io) io.emit('call:processing', { userId: call.userId, status: 'transcribing' });

    const transcript = await transcribeAudio(audioBuffer);
    if (!transcript) throw new Error('Could not transcribe audio');

    models.addMessage(call.userId, 'user', `[ÁUDIO] ${transcript}`);

    if (io) io.emit('call:transcribed', { userId: call.userId, text: transcript });

    if (io) io.emit('call:processing', { userId: call.userId, status: 'thinking' });
    const aiResponse = await getAIResponse(call.userId, transcript);
    models.addMessage(call.userId, 'assistant', `[RESPOSTA DE VOZ] ${aiResponse}`);

    if (io) io.emit('call:processing', { userId: call.userId, status: 'synthesizing' });
    const audioResponse = await synthesizeSpeech(aiResponse);

    if (io) io.emit('call:response', { userId: call.userId, text: aiResponse });

    return { text: aiResponse, audio: audioResponse };
  } catch (err) {
    logger.error(`Call audio processing error: ${err.message}`);
    return null;
  }
}

export function getActiveCalls() {
  return Array.from(activeCalls.values());
}
