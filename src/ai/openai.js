import OpenAI from 'openai';
import config from '../config.js';
import models from '../database/models.js';
import logger from '../logger.js';

const openai = new OpenAI({
  apiKey: config.ai.apiKey,
  baseURL: config.ai.baseURL,
});

const systemPrompt = `Você é um assistente de IA amigável e prestativo. 
Você fala português brasileiro naturalmente, como um amigo conversando no WhatsApp.
Seja conciso mas educado. Use emojis quando apropriado.
Você pode ajudar com: informações, conversas, música, brincadeiras e o que mais precisarem.
Mantenha as respostas em no máximo 3 parágrafos para WhatsApp.
Se alguém pedir música, lembre-os de usar !play <nome da música>.
Se não souber algo, seja honesto.`;

export async function getAIResponse(userId, message) {
  try {
    const history = models.getHistory(userId, 10);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: config.ai.model,
      messages,
      max_tokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
    });

    const text = completion.choices[0]?.message?.content || 'Desculpe, não consegui processar isso.';
    return text;
  } catch (err) {
    logger.error(`AI error: ${err.message}`);
    return '😅 Desculpe, estou tendo dificuldades para processar sua mensagem agora. Tente novamente em alguns instantes.';
  }
}

export async function detectIntent(text) {
  try {
    const completion = await openai.chat.completions.create({
      model: config.ai.model,
      messages: [
        { role: 'system', content: 'Classifique a intenção do usuário em UMA palavra: saudacao, pergunta, musica, chamada, despedida, comando, outro. Responda apenas a palavra.' },
        { role: 'user', content: text },
      ],
      max_tokens: 10,
      temperature: 0,
    });
    return completion.choices[0]?.message?.content?.trim().toLowerCase() || 'outro';
  } catch {
    return 'outro';
  }
}
