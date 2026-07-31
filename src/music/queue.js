import models from '../database/models.js';
import logger from '../logger.js';

export class MusicQueue {
  constructor() {
    this.tracks = [];
  }

  loadFromDb() {
    this.tracks = models.getQueue();
    return this.tracks;
  }

  add(userId, title, url, duration) {
    models.addToQueue(userId, title, url, duration);
    this.tracks.push({ title, url, duration });
    logger.info(`Added to queue: ${title}`);
  }

  next() {
    const nextTrack = this.tracks.shift();
    if (nextTrack) models.markPlayed(nextTrack.id);
    return nextTrack || null;
  }

  clear() {
    this.tracks = [];
    models.clearQueue();
  }

  get length() {
    return this.tracks.length;
  }
}
