import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, Square, Trash2, Volume2, Music } from 'lucide-react';
import { api, getSocket } from '../api/client';

export default function MusicPage() {
  const [player, setPlayer] = useState(null);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [volume, setVolume] = useState(50);

  useEffect(() => {
    fetchState();
    const socket = getSocket();
    socket.on('player_state', s => setPlayer(prev => ({ ...prev, ...s })));
    socket.on('queue_update', q => setQueue(Array.isArray(q) ? q : []));
    socket.on('history_update', h => setHistory(Array.isArray(h) ? h : []));
    return () => {
      socket.off('player_state');
      socket.off('queue_update');
      socket.off('history_update');
    };
  }, []);

  async function fetchState() {
    try {
      const res = await api('/player');
      if (res) {
        setPlayer(res);
        setQueue(res.queue || []);
        setHistory(res.history || []);
        if (res.volume !== undefined) setVolume(res.volume);
      }
    } catch {}
  }

  async function doAction(action) {
    try {
      const res = await api('/player/control', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setPlayer(prev => ({ ...prev, ...res }));
    } catch {}
  }

  async function removeFromQueue(index) {
    try {
      await api('/player/queue', {
        method: 'DELETE',
        body: JSON.stringify({ index }),
      });
      setQueue(prev => prev.filter((_, i) => i !== index));
    } catch {}
  }

  async function changeVolume(val) {
    setVolume(val);
    try {
      await api('/player/volume', {
        method: 'POST',
        body: JSON.stringify({ volume: val }),
      });
    } catch {}
  }

  const current = player?.current;

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Música</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '.9rem' }}>Controle do player de música</p>

      <div className="section">
        <div className="section-header"><h2><Music size={18} /> Player</h2></div>
        <div className="section-body">
          <div className="music-player">
            {current ? (
              <div className="music-current">
                <div className="title">{current.title || 'Tocando agora'}</div>
                <div className="artist">{current.artist || current.channel || ''}</div>
                <div className="duration">{current.duration || ''}</div>
              </div>
            ) : (
              <div className="empty-state"><h3>Nenhuma música tocando</h3><p>Use !play no WhatsApp para adicionar músicas</p></div>
            )}

            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${player?.progress || 0}%` }} />
            </div>

            <div className="music-controls">
              <button onClick={() => doAction('prev')} disabled={!current} title="Anterior">
                <SkipForward size={18} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <button onClick={() => doAction(player?.playing ? 'pause' : 'play')} className="play-btn" title={player?.playing ? 'Pausar' : 'Tocar'}>
                {player?.playing ? <Pause size={24} /> : <Play size={24} />}
              </button>
              <button onClick={() => doAction('next')} disabled={!current} title="Próxima">
                <SkipForward size={18} />
              </button>
              <button onClick={() => doAction('stop')} disabled={!current} title="Parar">
                <Square size={18} />
              </button>
            </div>

            <div className="volume-wrap">
              <Volume2 size={18} color="var(--text-muted)" />
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={e => changeVolume(parseInt(e.target.value))}
              />
              <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', minWidth: 30 }}>{volume}%</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="section">
          <div className="section-header"><h2>Fila de Reprodução</h2><span style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>{queue.length} músicas</span></div>
          <div className="section-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
            {queue.length === 0 ? (
              <div className="empty-state"><p>Fila vazia</p></div>
            ) : queue.map((item, i) => (
              <div key={i} className={`queue-item ${i === 0 && current ? 'active' : ''}`}>
                <span className="idx">{i + 1}</span>
                <span className="title">{item.title || 'Música'}</span>
                <button className="remove-btn" onClick={() => removeFromQueue(i)} title="Remover">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <div className="section-header"><h2>Histórico</h2><span style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>{history.length} músicas</span></div>
          <div className="section-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
            {history.length === 0 ? (
              <div className="empty-state"><p>Nenhuma música tocada</p></div>
            ) : history.slice().reverse().map((item, i) => (
              <div key={i} className="queue-item">
                <span className="idx">{history.length - i}</span>
                <span className="title">{item.title || item.name || 'Música'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
