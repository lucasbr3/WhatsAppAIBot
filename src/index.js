import './database/migrations.js';
import config from './config.js';
import logger from './logger.js';
import { createServer } from './api/server.js';
import { startClient, getClient } from './whatsapp/client.js';
import { getMusicPlayer } from './music/player.js';

async function main() {
  logger.info('=== WhatsApp AI Bot Starting ===');

  if (!config.ai.apiKey || config.ai.apiKey === 'sk-your-key-here') {
    logger.warn('OPENAI_API_KEY not configured. AI features will not work.');
  }

  const { io } = createServer(null);
  const sock = await startClient(io);
  getMusicPlayer().socket = sock;

  logger.info('Bot initialized successfully');
  logger.info(`Dashboard: http://localhost:${config.port}`);
}

main().catch((err) => {
  logger.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
