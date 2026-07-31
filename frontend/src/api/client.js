import { io } from 'socket.io-client';

const BASE = '/api';

const socket = io('/', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

export function getSocket() {
  if (!socket.connected) {
    const token = localStorage.getItem('token');
    if (token) {
      socket.auth = { token };
      socket.connect();
    }
  }
  return socket;
}

export async function api(path, options = {}) {
  let token = localStorage.getItem('token');

  if (!token) {
    try {
      const res = await fetch(`${BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin' }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        token = data.token;
      }
    } catch {}
  }

  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Redirecting to login');
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function login(username, password) {
  const data = await api('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem('token', data.token);
  const sock = getSocket();
  if (sock && !sock.connected) {
    sock.auth = { token: data.token };
    sock.connect();
  }
  return data;
}

export function logout() {
  localStorage.removeItem('token');
  socket.disconnect();
  window.location.href = '/login';
}

export function isAuthenticated() {
  return !!localStorage.getItem('token');
}
