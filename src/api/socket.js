import jwt from 'jsonwebtoken';
import config from '../config.js';
import logger from '../logger.js';
import { getMusicPlayer } from '../music/player.js';

export function setupSocket(io, sock) {
  io.on('connection', (socket) => {
    logger.info(`Dashboard client connected: ${socket.id}`);

    socket.on('auth', (token) => {
      try {
        jwt.verify(token, config.auth.jwtSecret);
        socket.join('authenticated');
        socket.emit('auth:success');
        socket.emit('status:update', {
          whatsapp: sock ? 'connected' : 'disconnected',
          player: getMusicPlayer().getStatus(),
        });
      } catch {
        socket.emit('auth:error', 'Invalid token');
      }
    });

    socket.on('player:control', async (data) => {
      if (!socket.rooms.has('authenticated')) return;
      const result = await getMusicPlayer().control(data.action, data.value);
      io.to('authenticated').emit('player:status', getMusicPlayer().getStatus());
    });

    socket.on('send:message', async (data) => {
      if (!socket.rooms.has('authenticated') || !sock) return;
      try {
        await sock.sendMessage(data.jid, { text: data.text });
      } catch (err) {
        socket.emit('send:error', err.message);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Dashboard client disconnected: ${socket.id}`);
    });
  });

  setInterval(() => {
    io.to('authenticated').emit('status:update', {
      whatsapp: sock ? 'connected' : 'disconnected',
      player: getMusicPlayer().getStatus(),
      uptime: process.uptime(),
      usersCount: 0,
    });
  }, 5000);
}
