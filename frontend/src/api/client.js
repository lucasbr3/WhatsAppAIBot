import { io } from 'socket.io-client';

const BASE = '/api';

const socket = io('/', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

let authPromise = null;

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

  if (!token && !authPromise) {
    authPromise = autoLogin();
  }
  if (authPromise) {
    await authPromise;
    token = localStorage.getItem('token');
    authPromise = null;
  }

  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401 && token) {
      localStorage.removeItem('token');
      return api(path, options);
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function autoLogin() {
  try {
    const res = await fetch(`${BASE}/public-login`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.token);
      const sock = getSocket();
      if (sock && !sock.connected) {
        sock.auth = { token: data.token };
        sock.connect();
      }
    }
  } catch {}
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
