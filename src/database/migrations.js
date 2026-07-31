import db from './index.js';
import logger from '../logger.js';

export function runMigrations() {
  logger.info('Running database migrations...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      push_name TEXT,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      message_count INTEGER DEFAULT 0,
      blocked INTEGER DEFAULT 0,
      is_admin INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS music_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      source TEXT DEFAULT 'youtube',
      duration INTEGER DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      played INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      direction TEXT DEFAULT 'incoming',
      duration INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME DEFAULT NULL,
      transcription TEXT,
      ai_response TEXT,
      audio_url TEXT
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  try { db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE call_logs ADD COLUMN transcription TEXT'); } catch {}
  try { db.exec('ALTER TABLE call_logs ADD COLUMN ai_response TEXT'); } catch {}
  try { db.exec('ALTER TABLE call_logs ADD COLUMN audio_url TEXT'); } catch {}

  logger.info('Migrations completed');
}

runMigrations();
