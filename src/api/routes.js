import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config.js';
import models from '../database/models.js';
import logger from '../logger.js';
import { getMusicPlayer } from '../music/player.js';

function generateToken() {
  return jwt.sign({ user: config.auth.adminUser }, config.auth.jwtSecret, { expiresIn: '24h' });
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    jwt.verify(token, config.auth.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function setupRoutes(app, sock) {
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === config.auth.adminUser && password === config.auth.adminPassword) {
      const token = generateToken();
      res.json({ token });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.get('/api/status', authMiddleware, (req, res) => {
    res.json({
      whatsapp: sock ? 'connected' : 'disconnected',
      users: models.getAllUsers().length,
      player: getMusicPlayer().getStatus(),
      uptime: process.uptime(),
    });
  });

  app.get('/api/users', authMiddleware, (req, res) => {
    res.json(models.getAllUsers());
  });

  app.get('/api/messages', authMiddleware, (req, res) => {
    const userId = req.query.userId;
    if (userId) {
      res.json(models.getHistory(userId, 50));
    } else {
      res.json([]);
    }
  });

  app.get('/api/calls', authMiddleware, (req, res) => {
    res.json(models.getCallLogs());
  });

  app.get('/api/player', authMiddleware, (req, res) => {
    res.json(getMusicPlayer().getStatus());
  });

  app.post('/api/player/control', authMiddleware, async (req, res) => {
    const { action, value } = req.body;
    const result = await getMusicPlayer().control(action, value);
    res.json({ result, status: getMusicPlayer().getStatus() });
  });

  app.get('/api/logs', authMiddleware, (req, res) => {
    res.json(models.getLogs());
  });

  app.post('/api/send', authMiddleware, async (req, res) => {
    const { jid, text } = req.body;
    if (!sock) return res.status(503).json({ error: 'WhatsApp not connected' });
    try {
      await sock.sendMessage(jid, { text });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/refresh-token', authMiddleware, (req, res) => {
    res.json({ token: generateToken() });
  });
}
