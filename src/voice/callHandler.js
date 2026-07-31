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
    logger.info(`Incoming call from ${userId}, status: ${call.status}`);

    const callId = call.id;
    activeCalls.set(callId, { userId, status: 'rejecting' });

    await sock.rejectCall(call.id, callerJid);

    await sock.sendMessage(callerJid, {
      text: '📵 Não consigo atender chamadas de voz pelo WhatsApp.\n\nMas você pode continuar falando comigo por mensagem ou áudio normalmente!',
    });

    models.addMessage(userId, 'system', 'Tentou uma chamada de voz (rejeitada)');
    models.logCall(userId, 'incoming', 0, 'rejected');
    activeCalls.delete(callId);

    return { answered: false, rejected: true, callId };
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
