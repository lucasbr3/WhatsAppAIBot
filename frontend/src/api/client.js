import { io } from 'socket.io-client';

const BASE = '/api';

const socket = io('/', {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

export function getSocket() {
  return socket;
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
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
  return data;
}

export function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login';
}

export function isAuthenticated() {
  return !!localStorage.getItem('token');
}
