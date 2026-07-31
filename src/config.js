import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '..', '.env') });

export default {
  port: parseInt(process.env.PORT || '3000'),
  whatsapp: {
    number: process.env.WHATSAPP_NUMBER || '',
    sessionPath: process.env.SESSION_PATH || './data/session',
  },
  ai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1024'),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  },
  voice: {
    sttProvider: process.env.STT_PROVIDER || 'openai',
    ttsProvider: process.env.TTS_PROVIDER || 'openai',
    ttsVoice: process.env.TTS_VOICE || 'alloy',
    callAutoAnswer: process.env.CALL_AUTO_ANSWER !== 'false',
  },
  database: {
    url: process.env.DATABASE_URL || './data/bot.db',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    adminUser: process.env.ADMIN_USER || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  },
  music: {
    source: process.env.MUSIC_SOURCE || 'youtube',
    maxPlaylist: parseInt(process.env.MAX_PLAYLIST_SIZE || '50'),
  },
  security: {
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '30'),
  },
};
