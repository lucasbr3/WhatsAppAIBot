import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, Trash2, MessageSquare } from 'lucide-react';
import { api, getSocket } from '../api/client';

export default function Conversations() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    const socket = getSocket();
    socket.on('new_message', msg => {
      setConversations(prev => {
        const idx = prev.findIndex(c => c.jid === msg.jid);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], lastMessage: msg.text, lastTime: msg.time, unread: (updated[idx].unread || 0) + 1 };
          return updated.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
        }
        return prev;
      });
      if (selected && (msg.jid === selected || msg.from === selected)) {
        setMessages(prev => [...prev, msg]);
      }
    });
    return () => { socket.off('new_message'); };
  }, [selected]);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (selected) fetchMessages(selected);
  }, [selected]);

  async function fetchConversations() {
    try {
      const res = await api('/conversations');
      setConversations(Array.isArray(res) ? res : []);
    } catch {}
  }

  async function fetchMessages(jid) {
    try {
      const res = await api(`/conversations/${encodeURIComponent(jid)}`);
      setMessages(Array.isArray(res) ? res : []);
    } catch {}
  }

  async function sendMessage() {
    if (!text.trim() || !selected) return;
    try {
      const res = await api('/send', {
        method: 'POST',
        body: JSON.stringify({ jid: selected, text: text.trim() }),
      });
      setMessages(prev => [...prev, { from: 'me', text: text.trim(), time: new Date().toISOString() }]);
      setText('');
      inputRef.current?.focus();
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function deleteConversation(jid) {
    if (!confirm('Apagar histórico desta conversa?')) return;
    try {
      await api(`/conversations/${encodeURIComponent(jid)}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.jid !== jid));
      if (selected === jid) { setSelected(null); setMessages([]); }
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(null), 3000);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const filtered = conversations.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    c.jid?.includes(search)
  );

  const selConv = conversations.find(c => c.jid === selected);

  return (
    <div>
      {toast && <div className="toast error">{toast}</div>}
      <div className="section" style={{ overflow: 'hidden', height: 'calc(100vh - 48px)' }}>
        <div className="chat-layout">
          <div className="chat-list">
            <div className="chat-list-header">
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  style={{ paddingLeft: 32 }}
                  placeholder="Pesquisar conversas..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <MessageSquare size={36} />
                <p>Nenhuma conversa</p>
              </div>
            ) : filtered.map(c => (
              <div
                key={c.jid}
                className={`chat-item ${selected === c.jid ? 'active' : ''}`}
                onClick={() => setSelected(c.jid)}
              >
                <div className="chat-item-avatar">
                  {(c.name || c.jid || '?')[0].toUpperCase()}
                </div>
                <div className="chat-item-info">
                  <div className="chat-item-name">{c.name || c.jid}</div>
                  <div className="chat-item-preview">{c.lastMessage || ''}</div>
                </div>
                <div className="chat-item-time">
                  {c.lastTime ? new Date(c.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            ))}
          </div>

          <div className="chat-main">
            {!selected ? (
              <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={48} />
                <h3>Selecione uma conversa</h3>
                <p>Escolha um contato para visualizar as mensagens</p>
              </div>
            ) : (
              <>
                <div className="chat-header">
                  <div className="chat-item-avatar">{(selConv?.name || selected || '?')[0].toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <h3>{selConv?.name || selected}</h3>
                    <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>{selected}</span>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => deleteConversation(selected)} title="Apagar conversa">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="chat-messages">
                  {messages.length === 0 ? (
                    <div className="empty-state"><p>Nenhuma mensagem neste chat</p></div>
                  ) : messages.map((msg, i) => (
                    <div key={i} className={`message ${msg.from === 'me' ? 'outgoing' : 'incoming'}`}>
                      <div>{msg.text}</div>
                      <div className="message-time">
                        {msg.time ? new Date(msg.time).toLocaleString() : ''}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEnd} />
                </div>
                <div className="chat-input">
                  <input
                    ref={inputRef}
                    placeholder="Digite sua mensagem..."
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button className="btn btn-primary btn-sm" onClick={sendMessage} disabled={!text.trim()}>
                    <Send size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
