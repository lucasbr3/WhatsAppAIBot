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
    apiKey: process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || '',
    model: process.env.OPENAI_MODEL || process.env.GROQ_MODEL || 'gpt-4o-mini',
    baseURL:
      process.env.OPENAI_BASE_URL ||
      process.env.GROQ_BASE_URL ||
      (process.env.GROQ_API_KEY ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1'),
    sttModel: process.env.STT_MODEL || (process.env.GROQ_API_KEY ? 'whisper-large-v3' : 'whisper-1'),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '1024'),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  },
  voice: {
    sttProvider: process.env.STT_PROVIDER || 'openai',
    ttsProvider: process.env.TTS_PROVIDER || 'openai',
    ttsVoice: process.env.TTS_VOICE || 'alloy',
    callAutoAnswer: process.env.CALL_AUTO_ANSWER !== 'false',
  },
  meta: {
    accessToken: process.env.META_ACCESS_TOKEN || '',
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
    verifyToken: process.env.META_VERIFY_TOKEN || 'whiskeyverify123',
    graphVersion: process.env.META_GRAPH_VERSION || 'v21.0',
    enabled: !!(process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID),
  },
  database: {
    url: process.env.DATABASE_URL || './data/bot.db',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    adminUser: process.env.ADMIN_USER || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin',
    disabled: process.env.AUTH_DISABLED === 'true',
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
