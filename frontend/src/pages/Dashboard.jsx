import React, { useState, useEffect } from 'react';
import { Smartphone, Users, MessageSquare, Phone, Music, Clock, Activity, ScrollText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatusCard from '../components/StatusCard';
import { api, getSocket } from '../api/client';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchStatus();
    const socket = getSocket();
    socket.on('status', s => { setData(prev => ({ ...prev, ...s })); });
    socket.on('log', entry => {
      setLogs(prev => [entry, ...prev].slice(0, 100));
    });
    return () => { socket.off('status'); socket.off('log'); };
  }, []);

  async function fetchStatus() {
    try {
      const res = await api('/status');
      setData(res);
    } catch {}
  }

  const isOnline = data?.whatsappStatus === 'connected' || data?.whatsappStatus === 'online';

  const stats = [
    { label: 'Status WhatsApp', value: data ? (isOnline ? 'Online' : 'Offline') : '—', icon: Smartphone, color: isOnline ? 'green' : 'red', sub: data?.whatsappUser || '' },
    { label: 'Tempo Online', value: data?.uptime || '—', icon: Clock, color: 'blue' },
    { label: 'Usuários', value: data?.users ?? '—', icon: Users, color: 'accent' },
    { label: 'Mensagens', value: data?.messages ?? '—', icon: MessageSquare, color: 'green' },
    { label: 'Chamadas', value: data?.calls ?? '—', icon: Phone, color: 'yellow' },
    { label: 'Música Atual', value: data?.currentSong || 'Nenhuma', icon: Music, color: 'blue', sub: data?.queueSize ? `${data.queueSize} na fila` : '' },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Dashboard</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '.9rem' }}>Visão geral do WhatsApp AI Bot</p>

      {data?.qr && !isOnline && (
        <div className="section">
          <div className="qr-container">
            <h3>Conectar WhatsApp</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Escaneie o QR Code abaixo com o WhatsApp</p>
            <div className="qr-code" dangerouslySetInnerHTML={{ __html: data.qr }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>O código expira em 60 segundos</p>
          </div>
        </div>
      )}

      <div className="cards-grid">
        {stats.map(s => <StatusCard key={s.label} {...s} />)}
      </div>

      <div className="charts-grid">
        <div className="section">
          <div className="section-header"><h2><Activity size={18} /> Atividade</h2></div>
          <div className="section-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.length ? chartData : [{ name: 'Sem dados', value: 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6 }} />
                  <Bar dataKey="value" fill="var(--accent)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header"><h2><ScrollText size={18} /> Últimos Eventos</h2></div>
          <div className="section-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {logs.length === 0 ? (
              <div className="empty-state"><p>Nenhum evento ainda</p></div>
            ) : logs.slice(0, 20).map((entry, i) => (
              <div key={i} className="log-entry" style={{ padding: '4px 0', fontSize: '.8rem' }}>
                <span className="log-time">{entry.time || ''}</span>
                <span className={`log-level ${entry.level || 'info'}`}>{entry.level || 'info'}</span>
                <span className="log-message">{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
