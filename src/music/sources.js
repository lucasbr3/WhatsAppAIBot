import logger from '../logger.js';

export async function searchYouTube(query) {
  try {
    const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    const html = await response.text();
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (match) {
      return {
        url: `https://www.youtube.com/watch?v=${match[1]}`,
        id: match[1],
      };
    }
    return null;
  } catch (err) {
    logger.error(`YouTube search error: ${err.message}`);
    return null;
  }
}

export async function searchMusic(query) {
  const youtube = await searchYouTube(query);
  if (youtube) return youtube;

  return null;
}
