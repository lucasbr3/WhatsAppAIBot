import { RTCPeerConnection, RtpBuilder } from 'werift';
import config from '../config.js';
import logger from '../logger.js';
import models from '../database/models.js';
import { transcribeAudio } from '../voice/stt.js';
import { synthesizeSpeech } from '../voice/tts.js';
import { getAIResponse } from '../ai/openai.js';
import { mp3ToOpusFrames, buildOggOpus } from './ogg.js';

const activeCalls = new Map();

function metaHeaders() {
  return { Authorization: `Bearer ${config.meta.accessToken}`, 'Content-Type': 'application/json' };
}

async function callGraph(action, callId, session) {
  const url = `https://graph.facebook.com/${config.meta.graphVersion}/${config.meta.phoneNumberId}/calls`;
  const body = {
    messaging_product: 'whatsapp',
    action,
    ...(callId ? { call_id: callId } : {}),
    ...(session ? { session } : {}),
  };
  const res = await fetch(url, { method: 'POST', headers: metaHeaders(), body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) logger.error(`Meta calls ${action} error: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

function fixAnswerSdp(sdp) {
  return sdp
    .replace('a=setup:actpass', 'a=setup:active');
}

function getOfferSdp(payload) {
  const calls = payload?.entry?.[0]?.changes?.[0]?.value?.calls || [];
  return calls.find((c) => c.session?.sdp)?.session?.sdp || null;
}

export function isMetaEnabled() {
  return config.meta.enabled;
}

export async function handleMetaWebhook(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === config.meta.verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  if (req.method === 'POST') {
    const payload = req.body;
    const offerSdp = getOfferSdp(payload);
    const callInfo = payload?.entry?.[0]?.changes?.[0]?.value?.calls?.[0] || {};

    if ((callInfo.event === 'ringing' || callInfo.event === 'connect') && offerSdp) {
      res.status(200).json({ status: 'accepted' });
      handleIncomingCall(callInfo, offerSdp).catch((e) => logger.error(`Call handling error: ${e.message}`));
      return;
    }

    if (callInfo.event === 'terminate' || callInfo.event === 'reject') {
      const call = activeCalls.get(callInfo.id);
      if (call) {
        call.status = 'terminated';
        try { call.pc?.close(); } catch {}
        activeCalls.delete(callInfo.id);
        models.logCall(call.userId, 'incoming', call.duration || 0, 'completed', call.transcription, call.aiResponse);
        if (call.emitToDashboard) call.emitToDashboard();
      }
    }

    return res.status(200).json({ status: 'ok' });
  }

  return res.sendStatus(405);
}

async function handleIncomingCall(callInfo, offerSdp) {
  const callerId = String(callInfo.from || '');
  const userId = callerId.replace('@s.whatsapp.net', '').replace('@c.us', '');
  const callId = callInfo.id;

  logger.info(`[META CALL] Incoming from ${userId}, id=${callId}`);

  const pc = new RTCPeerConnection();
  const call = {
    pc,
    status: 'ringing',
    userId,
    callId,
    transcription: '',
    aiResponse: '',
    duration: 0,
    emitToDashboard: null,
    inboundFrames: [],
    sender: null,
  };
  activeCalls.set(callId, call);

  const start = Date.now();

  pc.addTransceiver('audio', { direction: 'sendrecv' });

  pc.ontrack = ({ track, transceiver }) => {
    logger.info(`[META CALL] Remote track: ${track.kind}`);
    call.sender = transceiver.sender;
    transceiver.receiver.onReceiveRtp = (rtp) => {
      if (call.status === 'terminated') return;
      const payload = rtp.payload;
      if (payload && payload.length > 0) {
        call.inboundFrames.push(Buffer.from(payload));
        call.lastDataAt = Date.now();
      }
    };
  };

  try {
    await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const answerSdp = fixAnswerSdp(pc.localDescription.sdp);
    await callGraph('pre_accept', callId, { sdp_type: 'answer', sdp: answerSdp });
    await new Promise((r) => setTimeout(r, 1200));
    await callGraph('accept', callId, { sdp_type: 'answer', sdp: answerSdp });

    call.duration = Math.round((Date.now() - start) / 1000);
    logger.info(`[META CALL] Call ${callId} accepted after ${call.duration}s`);

    runVoiceLoop(call).catch((e) => logger.error(`Voice loop error: ${e.message}`));

    const watchdog = setTimeout(() => {
      if (call.status === 'accepted') return;
      logger.warn(`[META CALL] No media within 15s, terminating ${callId}`);
      terminateCall(callId).catch(() => {});
    }, 15000);
    call.watchdog = watchdog;
  } catch (e) {
    logger.error(`[META CALL] WebRTC setup error: ${e.message}`);
    await terminateCall(callId).catch(() => {});
  }
}

async function runVoiceLoop(call) {
  call.status = 'accepted';
  logger.info(`[META CALL] Voice loop started for ${call.userId}`);

  const sender = await waitForSender(call);
  if (!sender) {
    logger.warn(`[META CALL] No sender for ${call.userId}, terminating`);
    await terminateCall(call.callId).catch(() => {});
    return;
  }

  await waitForDtls(call, sender);
  await playGreeting(call, sender);

  let idleMs = 0;
  while (call.status === 'accepted' || call.status === 'processing') {
    await new Promise((r) => setTimeout(r, 500));

    if (call.status === 'terminated') return;

    if (call.inboundFrames.length > 0) {
      idleMs = 0;
      await new Promise((r) => setTimeout(r, 900));
      const frames = call.inboundFrames.splice(0);
      if (frames.length === 0) continue;

      call.status = 'processing';
      const audioBuffer = buildOggOpus(frames);
      const transcript = await transcribeAudio(audioBuffer);
      call.status = 'accepted';

      if (transcript) {
        call.transcription += ` ${transcript}`.trim();
        call.lastDataAt = Date.now();
        logger.info(`[META CALL] ${call.userId} said: ${transcript.slice(0, 100)}`);

        if (/^(tchau|adeus|fim|encerrar|sair)\b/i.test(transcript.trim())) {
          const farewell = await synthesizeSpeech('Até logo! Foi um prazer falar com você.');
          await sendAudioToTrack(call, sender, farewell);
          await terminateCall(call.callId).catch(() => {});
          return;
        }

        const aiResponse = await getAIResponse(call.userId, transcript);
        call.aiResponse = aiResponse;
        const audio = await synthesizeSpeech(aiResponse);
        if (audio) await sendAudioToTrack(call, sender, audio);
      }
      continue;
    }

    idleMs += 500;
    if (idleMs > 15000) {
      const timeoutMsg = await synthesizeSpeech('Não escutei nada, vou encerrar a chamada. Até mais!');
      await sendAudioToTrack(call, sender, timeoutMsg);
      await terminateCall(call.callId).catch(() => {});
      return;
    }
  }
}

async function waitForSender(call) {
  if (call.sender) return call.sender;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (call.sender) return call.sender;
    if (call.status === 'terminated') return null;
  }
  return null;
}

async function waitForDtls(call, sender) {
  for (let i = 0; i < 40; i++) {
    if (call.status === 'terminated') return;
    const state = sender.dtlsTransport?.state;
    if (state === 'connected' || state === 'completed') return;
    await new Promise((r) => setTimeout(r, 250));
  }
  logger.warn(`[META CALL] DTLS not connected for ${call.userId}`);
}

async function playGreeting(call, sender) {
  const greeting = await synthesizeSpeech('Olá! Eu sou o assistente do WhatsApp. Como posso ajudar?');
  if (greeting) await sendAudioToTrack(call, sender, greeting);
}

async function sendAudioToTrack(call, sender, mp3Buffer) {
  if (!sender || call.status === 'terminated') return;
  try {
    const frames = await mp3ToOpusFrames(mp3Buffer);
    const builder = new RtpBuilder({ clockRate: 48000, between: 20 });
    for (const f of frames) {
      if (call.status === 'terminated') return;
      const rtp = builder.create(f.packet);
      await sender.sendRtp(rtp);
      await new Promise((r) => setTimeout(r, 18));
    }
    logger.info(`[META CALL] Sent ${frames.length} opus frames`);
  } catch (e) {
    logger.error(`[META CALL] send audio: ${e.message}`);
  }
}

export async function terminateCall(callId) {
  const call = activeCalls.get(callId);
  if (!call) return;
  call.status = 'terminated';
  clearTimeout(call.watchdog);
  try { call.pc?.close(); } catch {}
  await callGraph('terminate', callId).catch(() => {});
  activeCalls.delete(callId);
  models.logCall(call.userId, 'incoming', call.duration || 0, 'completed', call.transcription, call.aiResponse);
}

export function getActiveMetaCalls() {
  return Array.from(activeCalls.values()).map((c) => ({ callId: c.callId, userId: c.userId, status: c.status }));
}
