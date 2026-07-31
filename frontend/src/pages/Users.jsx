import React, { useState, useEffect } from 'react';
import { User, Shield, Ban, MessageSquare, Clock } from 'lucide-react';
import { api } from '../api/client';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      const res = await api('/users');
      setUsers(Array.isArray(res) ? res : []);
    } catch {}
  }

  async function toggleBlock(jid, blocked) {
    try {
      await api('/users/block', {
        method: 'POST',
        body: JSON.stringify({ jid, blocked: !blocked }),
      });
      setUsers(prev => prev.map(u => u.jid === jid ? { ...u, blocked: !blocked } : u));
      showToast(blocked ? 'Usuário desbloqueado' : 'Usuário bloqueado', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function showToast(msg, type) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Usuários</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '.9rem' }}>Todos os contatos do WhatsApp</p>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="section">
        <div className="section-header">
          <h2>Contatos ({users.length})</h2>
          <button className="btn btn-ghost btn-sm" onClick={fetchUsers}>Atualizar</button>
        </div>
        <div className="section-body" style={{ padding: 0 }}>
          {users.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <User size={36} />
              <p>Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Número</th>
                    <th>Mensagens</th>
                    <th>Última Interação</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.jid || i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="chat-item-avatar" style={{ width: 32, height: 32, fontSize: '.8rem' }}>
                            {(u.name || u.jid || '?')[0].toUpperCase()}
                          </div>
                          <strong>{u.name || 'Sem nome'}</strong>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '.85rem' }}>{u.jid}</td>
                      <td>{u.messageCount ?? u.messages ?? 0}</td>
                      <td style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
                        {u.lastInteraction ? new Date(u.lastInteraction).toLocaleString() : '—'}
                      </td>
                      <td>
                        {u.blocked ? (
                          <span className="status-badge status-offline"><Ban size={12} /> Bloqueado</span>
                        ) : (
                          <span className="status-badge status-online">Ativo</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${u.blocked ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => toggleBlock(u.jid, u.blocked)}
                        >
                          {u.blocked ? 'Desbloquear' : 'Bloquear'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
