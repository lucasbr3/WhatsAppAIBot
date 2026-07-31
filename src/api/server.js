import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import logger from '../logger.js';
import { setupRoutes } from './routes.js';
import { setupSocket } from './socket.js';
import { createRateLimiter } from './middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer(whatsappClient) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

  app.use(cors());
  app.use(express.json());
  app.use('/api', createRateLimiter());

  const dashboardPath = path.join(__dirname, '..', 'dashboard');
  app.use(express.static(dashboardPath));

  setupRoutes(app, whatsappClient);
  setupSocket(io, whatsappClient);

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(dashboardPath, 'index.html'), (err) => {
        if (err) res.status(404).json({ error: 'Dashboard not built. Run: cd frontend && npm install && npm run build' });
      });
    }
  });

  server.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`);
  });

  return { app, server, io };
}
