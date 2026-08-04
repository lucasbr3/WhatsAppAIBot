import React, { useState, useEffect } from 'react';
import { Phone, PhoneIncoming, Clock, Headphones, Activity } from 'lucide-react';
import { api } from '../api/client';

export default function Calls() {
  const [calls, setCalls] = useState([]);
  const [active, setActive] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchCalls(); }, []);

  async function fetchCalls() {
    try {
      const res = await api('/calls');
      if (Array.isArray(res)) {
        setCalls(res);
      } else {
        setCalls(res?.calls || []);
        setActive(res?.active || []);
      }
    } catch {}
  }

  function formatDuration(sec) {
    if (!sec) return '—';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Chamadas</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '.9rem' }}>Histórico de chamadas recebidas</p>

      {active.length > 0 && (
        <div className="section" style={{ marginBottom: 20, padding: 16 }}>
          <div className="section-header" style={{ padding: 0, border: 'none' }}>
            <h2><Activity size={15} /> Chamadas Ativas</h2>
            <span style={{ color: 'var(--green)', fontSize: '.85rem' }}>{active.length} em andamento</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {active.map((c) => (
              <div key={c.callId} className="config-row" style={{ margin: 0 }}>
                <span className="config-label">{c.userId}</span>
                <span className="config-value" style={{ color: 'var(--green)' }}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0, overflow: 'hidden' }}>
        <div style={{ borderRight: '1px solid var(--border-color)' }}>
          <div className="section-header">
            <h2>Ligações</h2>
            <span style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>{calls.length}</span>
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {calls.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <Phone size={36} />
                <p>Nenhuma chamada</p>
              </div>
            ) : calls.map((call, i) => (
              <div
                key={call.id || i}
                className={`chat-item ${selected?.id === call.id ? 'active' : ''}`}
                onClick={() => setSelected(call)}
              >
                <div className="chat-item-avatar" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
                  <PhoneIncoming size={18} />
                </div>
                <div className="chat-item-info">
                  <div className="chat-item-name">{call.jid || call.from || 'Desconhecido'}</div>
                  <div className="chat-item-preview">Duração: {formatDuration(call.duration)}</div>
                </div>
                <div className="chat-item-time">
                  {call.time ? new Date(call.time).toLocaleDateString() : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {!selected ? (
            <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 60 }}>
              <Phone size={48} />
              <h3>Selecione uma chamada</h3>
              <p>Veja os detalhes da chamada</p>
            </div>
          ) : (
            <div style={{ padding: 20 }}>
              <div className="section-header" style={{ padding: 0, border: 'none', marginBottom: 16 }}>
                <h2>Detalhes da Chamada</h2>
              </div>

              <div className="config-row">
                <span className="config-label"><PhoneIncoming size={14} /> Número</span>
                <span className="config-value">{selected.jid || selected.from}</span>
              </div>
              <div className="config-row">
                <span className="config-label"><Clock size={14} /> Duração</span>
                <span className="config-value">{formatDuration(selected.duration)}</span>
              </div>
              <div className="config-row">
                <span className="config-label"><Headphones size={14} /> Data</span>
                <span className="config-value">{selected.time ? new Date(selected.time).toLocaleString() : '—'}</span>
              </div>

              {selected.transcription && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ fontSize: '.95rem', marginBottom: 8 }}>Transcrição</h3>
                  <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: 14, fontSize: '.88rem', lineHeight: 1.6 }}>
                    {selected.transcription}
                  </div>
                </div>
              )}

              {selected.aiResponse && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ fontSize: '.95rem', marginBottom: 8 }}>Resposta da IA</h3>
                  <div style={{ background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)', padding: 14, fontSize: '.88rem', lineHeight: 1.6, color: 'var(--accent)' }}>
                    {selected.aiResponse}
                  </div>
                </div>
              )}

              {selected.audioUrl && (
                <div style={{ marginTop: 16 }}>
                  <h3 style={{ fontSize: '.95rem', marginBottom: 8 }}>Áudio Gerado</h3>
                  <audio controls src={selected.audioUrl} style={{ width: '100%' }}>
                    Seu navegador não suporta áudio.
                  </audio>
                </div>
              )}

              {(selected.transcription || selected.aiResponse || selected.audioUrl) ? null : (
                <div className="empty-state" style={{ marginTop: 20 }}>
                  <p>Sem dados adicionais desta chamada</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
