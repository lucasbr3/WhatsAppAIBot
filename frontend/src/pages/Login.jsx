import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { login } from '../api/client';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-box" onSubmit={handleSubmit}>
        <h1><MessageSquare size={28} color="#7c5cfc" /> WhatsApp AI Bot</h1>
        <p>Painel de controle administrativo</p>
        {error && <div className="toast error" style={{ position: 'static', marginBottom: 16, animation: 'none' }}>{error}</div>}
        <div className="form-group">
          <label>Usuário</label>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" required autoFocus />
        </div>
        <div className="form-group">
          <label>Senha</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
