import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import config from '../config.js';
import logger from '../logger.js';
import { handleMessage } from './handler.js';
import { handleCall } from '../voice/callHandler.js';
import db from '../database/index.js';
import models from '../database/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sessionDir = path.resolve(__dirname, '..', '..', config.whatsapp.sessionPath);

let sock = null;
let currentIo = null;
let userDisconnected = false;

export function getClient() {
  return sock;
}

export function getStatus() {
  if (!sock) return 'disconnected';
  try {
    return sock.user ? 'connected' : 'connecting';
  } catch {
    return 'disconnected';
  }
}

export async function startClient(io) {
  currentIo = io;
  const { version } = await fetchLatestBaileysVersion();
  logger.info(`Baileys version: ${version.join('.')}`);

  fs.mkdirSync(sessionDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    syncFullHistory: false,
    emitOwnEvents: false,
    browser: ['WhatsApp AI Bot', 'Chrome', '20.0'],
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      sock.qr = qr;
      if (io) io.to('authenticated').emit('status:update', { qr });
      logger.info('QR code generated');
    }
    if (connection === 'open') {
      sock.qr = null;
      if (io) io.to('authenticated').emit('status:update', { whatsappStatus: 'connected' });
      logger.info(`WhatsApp connected: ${sock.user?.id}`);
    }
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (io) io.to('authenticated').emit('status:update', { whatsappStatus: 'disconnected' });
      if (userDisconnected) {
        userDisconnected = false;
        logger.info('Manual disconnect, skipping auto-reconnect');
        return;
      }
      logger.warn(`WhatsApp disconnected, reason: ${reason}. Reconnecting...`);
      setTimeout(() => startClient(io), 5000);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;
      await handleMessage(sock, msg, io);
    }
  });

  sock.ev.on('call', async (calls) => {
    for (const call of calls) {
      if (config.voice.callAutoAnswer && call.status === 'offer') {
        await handleCall(sock, call);
      }
    }
  });

  return sock;
}

export async function disconnectClient() {
  userDisconnected = true;
  if (sock) {
    try { await sock.logout(); } catch {}
    try { sock.ws?.close(); } catch {}
    try { sock.end?.(); } catch {}
    sock = null;
  }
  try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
  logger.info('WhatsApp disconnected and session cleared');
  if (currentIo) startClient(currentIo);
}

export async function sendMessage(jid, text) {
  if (!sock) throw new Error('WhatsApp not connected');
  return sock.sendMessage(jid, { text });
}

export async function sendAudio(jid, buffer) {
  if (!sock) throw new Error('WhatsApp not connected');
  return sock.sendMessage(jid, {
    audio: buffer,
    mimetype: 'audio/mpeg',
    fileName: 'resposta.mp3',
  });
}
