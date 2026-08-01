import logger from '../logger.js';
import { getMusicPlayer } from '../music/player.js';
import models from '../database/models.js';
import { searchTikTok, downloadTikTokMedia, formatNumber, buildResultsText } from '../tiktok/search.js';
import { searchSpotify } from '../spotify/search.js';

const _pending = new Map();

export const processCommand = {
  async ping(sock, jid) {
    await sock.sendMessage(jid, { text: '🏓 Pong!' });
    return true;
  },

  async help(sock, jid) {
    const help = `🤖 *Comandos disponíveis:*

🎵 *Música:*
!play <nome> - Tocar música
!pause - Pausar
!resume - Continuar
!stop - Parar
!skip / !next - Próxima
!queue / !fila - Ver fila
!volume <0-100> - Volume

📱 *TikTok:*
!tiktok <termo> - Buscar vídeos
!tiktokmp3 <termo> - Baixar áudio do TikTok
!musica <nome> - Buscar no Spotify e baixar

🤖 *IA:*
!pergunta <texto> - Conversar com a IA
!audio <texto> - Resposta da IA em áudio

📞 *Chamadas:*
Ligue para o número para falar com a IA

📊 *Info:*
!ping - Testar conexão
!help - Esta mensagem
!status - Status do bot
!clear - Limpar histórico`;
    await sock.sendMessage(jid, { text: help });
    return true;
  },

  async status(sock, jid) {
    const users = models.getAllUsers().length;
    const queue = getMusicPlayer().getQueueList().length;
    const msg = `📊 *Status do Bot*

🤖 Conexão: 🟢 Online
👥 Usuários: ${users}
🎵 Fila: ${queue} músicas
⚡ Versão: 1.0.0`;
    await sock.sendMessage(jid, { text: msg });
    return true;
  },

  async clear(sock, jid) {
    const userId = jid.replace('@s.whatsapp.net', '');
    models.clearHistory(userId);
    await sock.sendMessage(jid, { text: '🗑️ Histórico limpo!' });
    return true;
  },

  async tiktok(sock, jid, args) {
    const sender = jid;
    if (!args.length) {
      await sock.sendMessage(jid, { text: '❌ Digite o termo de busca. Ex: !tiktok danca viral' });
      return true;
    }

    const query = args.join(' ');
    await sock.sendPresenceUpdate('composing', jid);
    await sock.sendMessage(jid, { text: `🔎 Buscando por "${query}"...` });

    try {
      const videos = await searchTikTok(query);
      if (!videos.length) {
        await sock.sendMessage(jid, { text: '❌ Nenhum vídeo encontrado.' });
        return true;
      }

      _pending.set(sender, { videos, query, type: 'video', time: Date.now() });
      await sock.sendMessage(jid, { text: buildResultsText(videos) });
    } catch (e) {
      logger.error(`TikTok search error: ${e.message}`);
      await sock.sendMessage(jid, { text: `❌ Erro na busca: ${e.message}` });
    }
    return true;
  },

  async tiktokmp3(sock, jid, args) {
    const sender = jid;
    if (!args.length) {
      await sock.sendMessage(jid, { text: '❌ Digite o termo. Ex: !tiktokmp3 danca viral' });
      return true;
    }

    const query = args.join(' ');
    await sock.sendPresenceUpdate('composing', jid);
    await sock.sendMessage(jid, { text: `🔎 Buscando "${query}"...` });

    try {
      const videos = await searchTikTok(query, 1);
      if (!videos.length) {
        await sock.sendMessage(jid, { text: '❌ Nenhum vídeo encontrado.' });
        return true;
      }

      const v = videos[0];
      await sock.sendMessage(jid, { text: `🎵 Baixando áudio de: ${v.title.slice(0, 50)} - @${v.author}` });
      const buffer = await downloadTikTokMedia(v.audioUrl);
      await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mp4', ptt: false });
    } catch (e) {
      logger.error(`TikTok mp3 error: ${e.message}`);
      await sock.sendMessage(jid, { text: `❌ Erro: ${e.message}` });
    }
    return true;
  },

  async musica(sock, jid, args) {
    if (!args.length) {
      await sock.sendMessage(jid, { text: '❌ Digite o nome da música. Ex: !musica Banda Calypso Tic Tac' });
      return true;
    }

    const query = args.join(' ');
    await sock.sendPresenceUpdate('composing', jid);
    await sock.sendMessage(jid, { text: `🔎 Buscando "${query}" no Spotify...` });

    try {
      const tracks = await searchSpotify(query, 1);
      if (!tracks.length) {
        await sock.sendMessage(jid, { text: '❌ Não encontrei essa música no Spotify.' });
        return true;
      }

      const t = tracks[0];
      await sock.sendMessage(jid, { text: `🎵 Spotify: *${t.title}* - ${t.artist}` });
      await sock.sendMessage(jid, { text: `⬇️ Baixando áudio...` });

      let tiktokQuery = `${t.title} ${t.artist}`;
      let fallbackQueries = [t.artist, t.title];

      let videos = await searchTikTok(tiktokQuery, 1);
      for (const fq of fallbackQueries) {
        if (videos.length) break;
        videos = await searchTikTok(fq, 1);
      }

      if (!videos.length) {
        await sock.sendMessage(jid, { text: '❌ Não consegui baixar o áudio dessa música.' });
        return true;
      }

      const v = videos[0];
      const buffer = await downloadTikTokMedia(v.audioUrl);
      await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mp4', ptt: false });
    } catch (e) {
      logger.error(`Musica command error: ${e.message}`);
      await sock.sendMessage(jid, { text: `❌ Erro: ${e.message}` });
    }
    return true;
  },
};

export async function handleTikTokSelection(sock, jid, text) {
  const pending = _pending.get(jid);
  if (!pending || Date.now() - pending.time > 60000) {
    _pending.delete(jid);
    return false;
  }

  const num = parseInt(text);
  if (isNaN(num) || num < 1 || num > pending.videos.length) return false;

  const v = pending.videos[num - 1];
  _pending.delete(jid);

  await sock.sendPresenceUpdate('composing', jid);
  await sock.sendMessage(jid, { text: `⬇️ Baixando... ${v.title.slice(0, 50)}` });

  try {
    const dlUrl = pending.type === 'video' ? v.videoUrl : v.audioUrl;
    const buffer = await downloadTikTokMedia(dlUrl);

    if (pending.type === 'video') {
      const cap = `🎬 *${v.title.slice(0, 100)}*\n👤 @${v.author}\n❤️ ${formatNumber(v.likes)}  👁 ${formatNumber(v.plays)}`;
      await sock.sendMessage(jid, { video: buffer, mimetype: 'video/mp4', caption: cap });
    } else {
      await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mp4', ptt: false });
    }
  } catch (e) {
    logger.error(`TikTok download error: ${e.message}`);
    await sock.sendMessage(jid, { text: `❌ Falha ao baixar: ${e.message}` });
  }
  return true;
}
