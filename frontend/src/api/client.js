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
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
