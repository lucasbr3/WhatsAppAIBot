import rateLimit from 'express-rate-limit';
import config from '../config.js';

export function createRateLimiter() {
  return rateLimit({
    windowMs: config.security.rateLimitWindow,
    max: config.security.rateLimitMax,
    message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
}
