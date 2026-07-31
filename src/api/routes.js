import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config.js';
import models from '../database/models.js';
import logger from '../logger.js';
import { getMusicPlayer } from '../music/player.js';

function generateToken() {
  return jwt.sign({ user: config.auth.adminUser }, config.auth.jwtSecret, { expiresIn: '24h' });
}

function authOptional(req, res, next) {
  if (config.auth.disabled) return next();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try { jwt.verify(token, config.auth.jwtSecret); req.authenticated = true; } catch {}
  }
  next();
}

function authRequired(req, res, next) {
  if (config.auth.disabled) return next();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    jwt.verify(token, config.auth.jwtSecret);
    req.authenticated = true;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function setupRoutes(app, sock, io) {
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (config.auth.disabled) {
      const token = generateToken();
      return res.json({ token });
    }
    if (username === config.auth.adminUser && password === config.auth.adminPassword) {
      const token = generateToken();
      res.json({ token });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.get('/api/status', authOptional, (req, res) => {
    const player = getMusicPlayer();
    const pStatus = player.getStatus();
    const allUsers = models.getAllUsers();
    const msgCount = allUsers.reduce((acc, u) => acc + (u.message_count || 0), 0);
    const calls = models.getCallLogs(999);
    res.json({
      whatsappStatus: sock ? 'connected' : 'disconnected',
      whatsappUser: sock?.user?.name || sock?.user?.id || '',
      qr: sock?.qr || null,
      uptime: formatUptime(process.uptime()),
      users: allUsers.length,
      messages: msgCount,
      calls: calls.length,
      currentSong: pStatus?.current?.title || null,
      queueSize: pStatus?.queue?.length || 0,
      aiEnabled: config.ai.enabled !== false,
    });
  });

  app.get('/api/users', authOptional, (req, res) => {
    const users = models.getAllUsers().map(u => ({
      jid: u.id,
      name: u.name || u.push_name || '',
      messageCount: u.message_count || 0,
      lastInteraction: u.last_seen,
      blocked: !!u.blocked,
      admin: !!u.is_admin,
    }));
    res.json(users);
  });

  app.post('/api/users/block', authRequired, (req, res) => {
    const { jid, blocked } = req.body;
    models.setUserBlock(jid, blocked);
    res.json({ success: true });
  });

  app.get('/api/conversations', authOptional, (req, res) => {
    const users = models.getAllUsers();
    const convs = users.map(u => {
      const last = models.getLastMessage(u.id);
      return {
        jid: u.id,
        name: u.name || u.push_name || u.id,
        lastMessage: last?.content || '',
        lastTime: last?.timestamp || u.last_seen,
        unread: 0,
      };
    }).filter(c => c.lastMessage).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
    res.json(convs);
  });

  app.get('/api/conversations/:jid', authOptional, (req, res) => {
    const msgs = models.getHistory(req.params.jid, 100).map(m => ({
      from: m.role === 'assistant' ? 'bot' : m.role === 'user' ? 'them' : 'me',
      text: m.content,
      time: m.timestamp,
    }));
    res.json(msgs);
  });

  app.delete('/api/conversations/:jid', authRequired, (req, res) => {
    models.clearHistory(req.params.jid);
    res.json({ success: true });
  });

  app.post('/api/send', authRequired, async (req, res) => {
    const { jid, text } = req.body;
    if (!sock) return res.status(503).json({ error: 'WhatsApp not connected' });
    try {
      await sock.sendMessage(jid, { text });
      models.addMessage(jid, 'user', text);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/calls', authOptional, (req, res) => {
    const calls = models.getCallLogs(100).map(c => ({
      id: c.id,
      jid: c.user_id,
      from: c.user_id,
      duration: c.duration,
      time: c.started_at,
      direction: c.direction,
      status: c.status,
      transcription: c.transcription || null,
      aiResponse: c.ai_response || null,
      audioUrl: c.audio_url || null,
    }));
    res.json(calls);
  });

  app.get('/api/player', authOptional, (req, res) => {
    const player = getMusicPlayer();
    const status = player.getStatus();
    res.json({
      ...status,
      volume: player.volume || 50,
      queue: status.queue || [],
      history: status.history || [],
    });
  });

  app.post('/api/player/control', authRequired, async (req, res) => {
    const { action } = req.body;
    const player = getMusicPlayer();
    await player.control(action);
    const status = player.getStatus();
    if (io) io.to('authenticated').emit('player_state', status);
    res.json(status);
  });

  app.post('/api/player/volume', authRequired, (req, res) => {
    const { volume } = req.body;
    const player = getMusicPlayer();
    if (player.setVolume) player.setVolume(volume);
    player.volume = volume;
    if (io) io.to('authenticated').emit('player_state', { volume });
    res.json({ volume });
  });

  app.delete('/api/player/queue', authRequired, (req, res) => {
    const { index } = req.body;
    const player = getMusicPlayer();
    if (player.removeFromQueue) player.removeFromQueue(index);
    const status = player.getStatus();
    if (io) io.to('authenticated').emit('queue_update', status.queue || []);
    res.json({ success: true });
  });

  app.get('/api/ai/config', authOptional, (req, res) => {
    res.json({
      enabled: config.ai.enabled !== false,
      model: config.ai.model || 'gpt-4o-mini',
      personality: config.ai.systemPrompt || 'Você é um assistente amigável que responde em português brasileiro de forma natural e simpática.',
      maxResponses: config.ai.maxResponses || 50,
    });
  });

  app.put('/api/ai/config', authRequired, (req, res) => {
    const { enabled, model, personality, maxResponses } = req.body;
    if (enabled !== undefined) { config.ai.enabled = enabled; models.setSetting('ai_enabled', enabled ? 'true' : 'false'); }
    if (model) { config.ai.model = model; models.setSetting('ai_model', model); }
    if (personality) { config.ai.systemPrompt = personality; models.setSetting('ai_personality', personality); }
    if (maxResponses !== undefined) { config.ai.maxResponses = maxResponses; models.setSetting('ai_max_responses', String(maxResponses)); }
    res.json({ success: true });
  });

  app.get('/api/ai/history', authOptional, (req, res) => {
    const users = models.getAllUsers();
    const history = [];
    for (const u of users.slice(0, 20)) {
      const msgs = models.getHistory(u.id, 2);
      if (msgs.length >= 2) {
        history.push({
          user: u.name || u.id,
          question: msgs[msgs.length - 2]?.content || '',
          answer: msgs[msgs.length - 1]?.content || '',
          time: msgs[msgs.length - 1]?.timestamp,
        });
      }
    }
    res.json(history.reverse().slice(0, 100));
  });

  app.get('/api/logs', authOptional, (req, res) => {
    res.json(models.getLogs(200));
  });

  app.get('/api/refresh-token', authRequired, (req, res) => {
    res.json({ token: generateToken() });
  });
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
