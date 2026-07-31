import logger from '../logger.js';
import { getMusicPlayer } from '../music/player.js';
import { getClient } from '../whatsapp/client.js';

export function setupSocket(io, _sock) {
  io.on('connection', (socket) => {
    logger.info(`Dashboard client connected: ${socket.id}`);
    socket.join('authenticated');
    emitStatus(socket, getClient());

    socket.on('player:control', async (data) => {
      const player = getMusicPlayer();
      await player.control(data.action, data.value);
      const status = player.getStatus();
      io.to('authenticated').emit('player_state', status);
      io.to('authenticated').emit('queue_update', status.queue || []);
    });

    socket.on('send:message', async (data) => {
      const s = getClient();
      if (!s) return;
      try {
        await s.sendMessage(data.jid, { text: data.text });
        socket.emit('send:success', { jid: data.jid, text: data.text });
      } catch (err) {
        socket.emit('send:error', err.message);
      }
    });

    socket.on('logs:subscribe', () => socket.join('logs'));
    socket.on('logs:unsubscribe', () => socket.leave('logs'));

    socket.on('disconnect', () => {
      logger.info(`Dashboard client disconnected: ${socket.id}`);
    });
  });

  setInterval(() => {
    io.to('authenticated').emit('status', buildStatus(getClient()));
  }, 5000);
}

export function emitStatus(ioOrSocket, sock) {
  const data = buildStatus(sock || getClient());
  if (ioOrSocket?.emit) {
    ioOrSocket.emit('status', data);
  } else {
    ioOrSocket?.to?.('authenticated')?.emit?.('status', data);
  }
}

export function emitLog(io, level, message) {
  const entry = {
    time: new Date().toLocaleTimeString(),
    level,
    message,
  };
  io.to('logs').emit('log', entry);
  io.to('authenticated').emit('log', entry);
}

function buildStatus(sock) {
  const player = getMusicPlayer();
  const pStatus = player.getStatus();
  return {
    whatsappStatus: sock?.user ? 'connected' : 'disconnected',
    whatsappUser: sock?.user?.name || sock?.user?.id || '',
    qr: sock?.qr || null,
    uptime: formatUptime(process.uptime()),
    users: 0,
    messages: 0,
    calls: 0,
    currentSong: pStatus?.current?.title || null,
    queueSize: pStatus?.queue?.length || 0,
    aiEnabled: true,
  };
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
