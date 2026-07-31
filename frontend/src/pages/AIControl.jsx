import React, { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { api } from '../api/client';

export default function AIControl() {
  const [config, setConfig] = useState({
    enabled: true,
    model: 'gpt-4o-mini',
    personality: 'Você é um assistente amigável que responde em português brasileiro de forma natural e simpática.',
    maxResponses: 50,
  });
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchConfig();
    fetchHistory();
  }, []);

  async function fetchConfig() {
    try {
      const res = await api('/ai/config');
      if (res) setConfig(prev => ({ ...prev, ...res }));
    } catch {}
  }

  async function fetchHistory() {
    try {
      const res = await api('/ai/history');
      setHistory(Array.isArray(res) ? res : []);
    } catch {}
  }

  async function saveConfig() {
    setSaving(true);
    try {
      await api('/ai/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      showToast('Configurações salvas!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function showToast(msg, type) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Inteligência Artificial</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '.9rem' }}>Controle do comportamento da IA</p>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="ai-config-grid">
        <div className="section">
          <div className="section-header"><h2>Configurações</h2></div>
          <div className="section-body">
            <div className="config-row">
              <span className="config-label">IA Ativa</span>
              <button
                className={`toggle ${config.enabled ? 'active' : ''}`}
                onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
              />
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label>Modelo</label>
              <select value={config.model} onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>
            <div className="form-group">
              <label>Personalidade (System Prompt)</label>
              <textarea
                value={config.personality}
                onChange={e => setConfig(prev => ({ ...prev, personality: e.target.value }))}
                rows={4}
              />
            </div>
            <div className="form-group">
              <label>Limite máximo de respostas/dia</label>
              <input
                type="number"
                value={config.maxResponses}
                onChange={e => setConfig(prev => ({ ...prev, maxResponses: parseInt(e.target.value) || 0 }))}
                min={0}
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={saveConfig} disabled={saving}>
              <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <h2>Histórico de Respostas</h2>
            <button className="btn btn-ghost btn-sm" onClick={fetchHistory}><RotateCcw size={14} /> Atualizar</button>
          </div>
          <div className="section-body" style={{ maxHeight: 500, overflowY: 'auto' }}>
            {history.length === 0 ? (
              <div className="empty-state"><p>Nenhuma resposta registrada</p></div>
            ) : history.map((item, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  {item.user} — {item.time ? new Date(item.time).toLocaleString() : ''}
                </div>
                <div style={{ marginBottom: 4 }}><strong>Pergunta:</strong> {item.question}</div>
                <div style={{ color: 'var(--text-secondary)' }}><strong>Resposta:</strong> {item.answer}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
