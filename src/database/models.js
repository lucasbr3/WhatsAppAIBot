import db from './index.js';

export default {
  // === Users ===
  getUser(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },
  upsertUser(id, name, pushName) {
    const existing = this.getUser(id);
    if (existing) {
      db.prepare('UPDATE users SET name = ?, push_name = ?, last_seen = CURRENT_TIMESTAMP, message_count = message_count + 1 WHERE id = ?').run(name, pushName, id);
    } else {
      db.prepare('INSERT INTO users (id, name, push_name) VALUES (?, ?, ?)').run(id, name, pushName);
    }
  },
  getAllUsers() {
    return db.prepare('SELECT * FROM users ORDER BY last_seen DESC').all();
  },
  setUserBlock(id, blocked) {
    db.prepare('UPDATE users SET blocked = ? WHERE id = ?').run(blocked ? 1 : 0, id);
  },

  // === Conversations ===
  addMessage(userId, role, content) {
    db.prepare('INSERT INTO conversations (user_id, role, content) VALUES (?, ?, ?)').run(userId, role, content);
  },
  getHistory(userId, limit = 20) {
    return db.prepare('SELECT role, content, timestamp FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?').all(userId, limit).reverse();
  },
  getLastMessage(userId) {
    return db.prepare('SELECT content, timestamp FROM conversations WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1').get(userId);
  },
  clearHistory(userId) {
    db.prepare('DELETE FROM conversations WHERE user_id = ?').run(userId);
  },

  // === Music ===
  addToQueue(userId, title, url, duration) {
    db.prepare('INSERT INTO music_queue (user_id, title, url, duration) VALUES (?, ?, ?, ?)').run(userId, title, url, duration);
  },
  getQueue(limit = 50) {
    return db.prepare('SELECT * FROM music_queue WHERE played = 0 ORDER BY added_at ASC LIMIT ?').all(limit);
  },
  markPlayed(id) {
    db.prepare('UPDATE music_queue SET played = 1 WHERE id = ?').run(id);
  },
  clearQueue() {
    db.prepare('DELETE FROM music_queue WHERE played = 0').run();
  },

  // === Call Logs ===
  logCall(userId, direction, duration, status, transcription, aiResponse, audioUrl) {
    db.prepare('INSERT INTO call_logs (user_id, direction, duration, status, transcription, ai_response, audio_url) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, direction, duration, status, transcription || null, aiResponse || null, audioUrl || null);
  },
  getCallLogs(limit = 50) {
    return db.prepare('SELECT * FROM call_logs ORDER BY started_at DESC LIMIT ?').all(limit);
  },

  // === Logs ===
  addLog(level, message) {
    db.prepare('INSERT INTO logs (level, message) VALUES (?, ?)').run(level, message);
  },
  getLogs(limit = 100) {
    return db.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?').all(limit);
  },

  // === Settings ===
  getSetting(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  },
  setSetting(key, value) {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  },
};
