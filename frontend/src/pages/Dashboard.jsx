import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Users, MessageSquare, Phone, Music, Clock, Activity, ScrollText, LogOut } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatusCard from '../components/StatusCard';
import { api, getSocket } from '../api/client';
import QRCode from 'qrcode';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const qrContainerRef = useRef(null);

  useEffect(() => {
    fetchStatus();
    const socket = getSocket();
    socket.on('status', s => { setData(prev => ({ ...prev, ...s })); generateQr(s.qr); });
    socket.on('log', entry => {
      setLogs(prev => [entry, ...prev].slice(0, 100));
    });
    return () => { socket.off('status'); socket.off('log'); };
  }, []);

  useEffect(() => {
    if (data?.qr) generateQr(data.qr);
  }, [data?.qr]);

  async function generateQr(text) {
    if (!text) { setQrDataUrl(null); return; }
    try {
      const url = await QRCode.toDataURL(text, { width: 300, margin: 2, color: { dark: '#000', light: '#fff' } });
      setQrDataUrl(url);
    } catch {}
  }

  async function fetchStatus() {
    try {
      const res = await api('/status');
      setData(res);
      if (res.qr) generateQr(res.qr);
    } catch {}
  }

  async function disconnectWhatsApp() {
    if (!confirm('Tem certeza? O WhatsApp será desconectado e um novo QR Code será gerado.')) return;
    try {
      await api('/whatsapp/disconnect', { method: 'POST' });
      setData(prev => ({ ...prev, whatsappStatus: 'disconnected', qr: null }));
      setQrDataUrl(null);
    } catch (err) {
      alert('Erro ao desconectar: ' + err.message);
    }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem', marginTop: 4 }}>Visão geral do WhatsApp AI Bot</p>
        </div>
        {isOnline && (
          <button className="btn btn-ghost btn-sm" onClick={disconnectWhatsApp} style={{ color: 'var(--red)' }}>
            <LogOut size={16} /> Desconectar WhatsApp
          </button>
        )}
      </div>

      {data && !isOnline && (
        <div className="section">
          <div className="qr-container">
            <h3>Conectar WhatsApp</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Escaneie o QR Code abaixo com o WhatsApp Web</p>
            {qrDataUrl ? (
              <div className="qr-code">
                <img src={qrDataUrl} alt="QR Code WhatsApp" />
              </div>
            ) : (
              <div className="qr-code" style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '.8rem' }}>
                {data?.whatsappStatus === 'connecting' ? 'Conectando...' : 'Aguardando QR Code...'}
              </div>
            )}
            <p style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>O código atualiza automaticamente a cada 60 segundos</p>
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
