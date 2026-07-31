let token = localStorage.getItem('token');
let socket = null;

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (res.ok) {
    const data = await res.json();
    token = data.token;
    localStorage.setItem('token', token);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    initSocket();
    loadData();
  } else {
    alert('Login inválido');
  }
}

function initSocket() {
  socket = io();
  socket.emit('auth', token);
  socket.on('whatsapp:status', (status) => {
    document.getElementById('bot-status').textContent = status;
    document.getElementById('bot-status').className = `status-${status}`;
  });
  socket.on('whatsapp:qr', (qr) => {
    document.getElementById('qr-code').innerHTML = `<pre>${qr}</pre>`;
  });
  socket.on('whatsapp:message', (msg) => {
    addLog(`${msg.name || msg.from}: ${msg.text}`);
    updateStats();
  });
  socket.on('status:update', (status) => {
    document.getElementById('bot-status').textContent = status.whatsapp || 'unknown';
    document.getElementById('bot-status').className = `status-${status.whatsapp || 'unknown'}`;
    if (status.player) updatePlayerUI(status.player);
  });
  socket.on('music:status', (status) => updatePlayerUI(status));
  socket.on('music:play', (track) => {
    document.getElementById('now-playing').textContent = track.title || track;
  });
}

function updatePlayerUI(player) {
  document.getElementById('now-playing').textContent = player.currentTrack?.title || 'Nenhuma';
  document.getElementById('queue-size').textContent = player.queueSize || 0;
  document.getElementById('volume-display').textContent = `${player.volume || 80}%`;
}

async function loadData() {
  try {
    const [status, users, calls, player] = await Promise.all([
      fetch('/api/status', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/calls', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/player', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]);
    document.getElementById('bot-status').textContent = status.whatsapp;
    document.getElementById('users-count').textContent = status.users || users.length;
    updatePlayerUI(player);
    renderUsers(users);
    renderCalls(calls);
  } catch (e) { console.error(e); }
}

function updateStats() {
  fetch('/api/status', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(s => {
    document.getElementById('users-count').textContent = s.users;
  });
}

function renderUsers(users) {
  const tbody = document.querySelector('#users-table tbody');
  tbody.innerHTML = users.slice(0, 20).map(u => `
    <tr>
      <td>${u.name || '—'}</td>
      <td>${u.id}</td>
      <td>${u.message_count || 0}</td>
      <td>${u.last_seen || '—'}</td>
    </tr>
  `).join('');
}

function renderCalls(calls) {
  const tbody = document.querySelector('#calls-table tbody');
  tbody.innerHTML = calls.slice(0, 20).map(c => `
    <tr>
      <td>${c.user_id}</td>
      <td>${c.direction}</td>
      <td>${c.duration}s</td>
      <td>${c.status}</td>
      <td>${c.started_at || '—'}</td>
    </tr>
  `).join('');
}

function addLog(msg) {
  const log = document.getElementById('logs');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  log.prepend(entry);
  if (log.children.length > 100) log.removeChild(log.lastChild);
}

async function controlPlayer(action, value) {
  await fetch('/api/player/control', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, value })
  });
}

function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.getElementById(`tab-${tab}`).style.display = 'block';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
}

function logout() {
  localStorage.removeItem('token');
  socket?.close();
  location.reload();
}

if (token) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'flex';
  initSocket();
  loadData();
}
