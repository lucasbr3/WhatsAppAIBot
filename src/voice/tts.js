import OpenAI from 'openai';
import config from '../config.js';
import logger from '../logger.js';

const openai = new OpenAI({
  apiKey: config.ai.apiKey,
  baseURL: config.ai.baseURL,
});

export async function synthesizeSpeech(text) {
  try {
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: config.voice.ttsVoice,
      input: text,
      response_format: 'opus',
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  } catch (err) {
    logger.error(`TTS error: ${err.message}`);
    return null;
  }
}
