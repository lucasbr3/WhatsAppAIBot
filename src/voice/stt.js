import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import logger from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: config.ai.apiKey,
  baseURL: config.ai.baseURL,
});

export async function transcribeAudio(audioBuffer) {
  try {
    const tmpDir = path.join(__dirname, '..', '..', 'data', 'tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, `audio_${Date.now()}.ogg`);
    fs.writeFileSync(tmpFile, audioBuffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpFile),
      model: config.ai.sttModel || 'whisper-1',
      language: 'pt',
      response_format: 'text',
    });

    fs.unlinkSync(tmpFile);
    return transcription;
  } catch (err) {
    logger.error(`STT error: ${err.message}`);
    return null;
  }
}
