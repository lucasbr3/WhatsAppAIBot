import logger from '../logger.js';

const searchCache = new Map();
const CACHE_TTL = 1800000;

export async function searchTikTok(query, count = 10) {
  const cacheKey = query.toLowerCase().trim();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data;

  const res = await fetch('https://tikwm.com/api/feed/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `keywords=${encodeURIComponent(query)}&count=${count}&cursor=0&region=BR`,
    signal: AbortSignal.timeout(15000),
  });
  const j = await res.json();
  if (j.code !== 0 || !j.data?.videos?.length) return [];

  const videos = j.data.videos.map(v => ({
    id: v.video_id,
    title: v.title?.replace(/[#]\S+/g, '').trim() || 'Sem título',
    author: v.author?.unique_id || 'desconhecido',
    nickname: v.author?.nickname || '',
    plays: v.play_count || 0,
    likes: v.digg_count || 0,
    comments: v.comment_count || 0,
    duration: v.duration || 0,
    videoUrl: v.play,
    videoUrlWm: v.wmplay,
    audioUrl: v.music,
    size: v.size || 0,
  }));

  searchCache.set(cacheKey, { data: videos, time: Date.now() });
  return videos;
}

export function formatNumber(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}

export async function downloadTikTokMedia(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error('Falha ao baixar mídia');
  return Buffer.from(await res.arrayBuffer());
}

export function buildResultsText(videos) {
  let text = '🔍 *Resultados encontrados:*\n\n';
  videos.forEach((v, i) => {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    text += `${emojis[i] || i + 1} *${v.title.slice(0, 40)}*\n`;
    text += `   👤 @${v.author}  👁 ${formatNumber(v.plays)}  ❤️ ${formatNumber(v.likes)}\n\n`;
  });
  text += '📌 *Digite o número do vídeo* (1-10)';
  return text;
}
