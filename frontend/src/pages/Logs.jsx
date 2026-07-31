import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Pause, Play, ScrollText } from 'lucide-react';
import { getSocket } from '../api/client';

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    socket.on('log', entry => {
      if (!paused) {
        setLogs(prev => [entry, ...prev].slice(0, 500));
      }
    });

    socket.emit('logs:subscribe');

    return () => {
      socket.off('log');
      socket.emit('logs:unsubscribe');
    };
  }, [paused]);

  function clearLogs() {
    setLogs([]);
  }

  function getLevel(entry) {
    if (entry.level) return entry.level;
    if (entry.message?.toLowerCase().includes('error') || entry.message?.toLowerCase().includes('erro')) return 'error';
    if (entry.message?.toLowerCase().includes('warn')) return 'warn';
    if (entry.message?.toLowerCase().includes('success') || entry.message?.toLowerCase().includes('conectado')) return 'success';
    return 'info';
  }

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Logs</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '.9rem' }}>Eventos do sistema em tempo real</p>

      <div className="section">
        <div className="section-header">
          <h2><ScrollText size={18} /> Eventos ({logs.length})</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPaused(!paused)}>
              {paused ? <Play size={14} /> : <Pause size={14} />}
              {paused ? ' Retomar' : ' Pausar'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={clearLogs}>
              <Trash2 size={14} /> Limpar
            </button>
          </div>
        </div>
        <div className="section-body" style={{ padding: 0 }}>
          <div className="logs-container" ref={containerRef}>
            {logs.length === 0 ? (
              <div className="empty-state">
                <p>Aguardando eventos do sistema...</p>
              </div>
            ) : logs.map((entry, i) => (
              <div key={i} className="log-entry">
                <span className="log-time">{entry.time || entry.timestamp || ''}</span>
                <span className={`log-level ${getLevel(entry)}`}>{getLevel(entry).toUpperCase()}</span>
                <span className="log-message">{entry.message || JSON.stringify(entry)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
