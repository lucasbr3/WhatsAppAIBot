import logger from '../logger.js';
import models from '../database/models.js';

let instance = null;

export class MusicPlayer {
  constructor() {
    this.queue = [];
    this.currentTrack = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.volume = 80;
    this.socket = null;
  }

  getQueueList() {
    return this.queue;
  }

  getCurrentTrack() {
    return this.currentTrack;
  }

  getStatus() {
    return {
      playing: this.isPlaying,
      paused: this.isPaused,
      currentTrack: this.currentTrack,
      queueSize: this.queue.length,
      volume: this.volume,
    };
  }

  async addToQueue(query, userId, io) {
    const track = {
      id: Date.now().toString(),
      title: query,
      source: 'youtube',
      userId,
      addedAt: new Date(),
    };

    this.queue.push(track);
    models.addToQueue(userId, query, '', 0);

    if (!this.isPlaying) {
      await this.playNext(io);
    }

    if (io) io.emit('music:queue', this.getStatus());
  }

  async playNext(io) {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.currentTrack = null;
      if (io) io.emit('music:status', this.getStatus());
      return;
    }

    this.currentTrack = this.queue.shift();
    this.isPlaying = true;
    this.isPaused = false;

    logger.info(`Playing: ${this.currentTrack.title}`);
    if (io) io.emit('music:play', this.currentTrack);
    if (io) io.emit('music:status', this.getStatus());

    const sock = this.socket;
    if (sock) {
      const jids = models.getAllUsers().map(u => `${u.id}@s.whatsapp.net`);
      for (const jid of jids) {
        sock.sendMessage(jid, { text: `🎵 **Tocando agora:** ${this.currentTrack.title}` }).catch(() => {});
      }
    }
  }

  async control(action, value) {
    switch (action) {
      case 'pause':
        if (this.isPlaying && !this.isPaused) {
          this.isPaused = true;
          return '⏸️ Pausado';
        }
        return 'Nada tocando no momento';

      case 'resume':
        if (this.isPaused) {
          this.isPaused = false;
          return '▶️ Continuando';
        }
        return 'Nada pausado';

      case 'stop':
        this.queue = [];
        this.isPlaying = false;
        this.isPaused = false;
        this.currentTrack = null;
        models.clearQueue();
        return '⏹️ Parado e fila limpa';

      case 'skip':
      case 'next':
        if (this.isPlaying) {
          await this.playNext();
          return `⏭️ Pulando para: ${this.currentTrack?.title || 'fim da fila'}`;
        }
        return 'Nada tocando';

      case 'volume':
        const vol = parseInt(value);
        if (vol >= 0 && vol <= 100) {
          this.volume = vol;
          return `🔊 Volume: ${vol}%`;
        }
        return `🔊 Volume atual: ${this.volume}%`;

      default:
        return 'Comando desconhecido';
    }
  }
}

export function getMusicPlayer() {
  if (!instance) instance = new MusicPlayer();
  return instance;
}
