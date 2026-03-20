/* ============================================================
   API utility – thin wrapper around fetch
   ============================================================ */
'use strict';

const API_BASE = '/api';

function getToken() { return localStorage.getItem('token'); }
function setToken(t) { localStorage.setItem('token', t); }
function removeToken() { localStorage.removeItem('token'); }

function getUser() {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
}
function setUser(u) { localStorage.setItem('user', JSON.stringify(u)); }
function removeUser() { localStorage.removeItem('user'); }

async function apiRequest(method, endpoint, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  try {
    const res  = await fetch(`${API_BASE}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) throw { status: res.status, message: data.message || 'Request failed', data };
    return data;
  } catch (err) {
    if (err.status) throw err;
    throw { status: 0, message: 'Network error – check your connection.' };
  }
}

const API = {
  get:    (ep)       => apiRequest('GET',    ep),
  post:   (ep, body) => apiRequest('POST',   ep, body),
  put:    (ep, body) => apiRequest('PUT',    ep, body),
  delete: (ep)       => apiRequest('DELETE', ep),
};

/* ── Auth helpers ────────────────────────────────────────────── */
function logout() {
  removeToken();
  removeUser();
  window.location.href = '/index.html';
}

function requireAuth(allowedRole) {
  const user = getUser();
  const token = getToken();
  if (!user || !token) {
    window.location.href = '/index.html';
    return null;
  }
  if (allowedRole && user.role !== allowedRole && !(allowedRole === 'teacher' && user.role === 'admin')) {
    window.location.href = '/index.html';
    return null;
  }
  return user;
}

/* ── DOM helpers ─────────────────────────────────────────────── */
function showAlert(containerId, type, message) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}">${escHtml(message)}</div>`;
  setTimeout(() => { if (el) el.innerHTML = ''; }, 5000);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dt) {
  if (!dt) return '–';
  return new Date(dt).toLocaleString();
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function setNavUser() {
  const user = getUser();
  const el = document.getElementById('nav-user');
  if (el && user) el.textContent = `${user.name} (${user.role})`;
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

/* ── Export to CSV ───────────────────────────────────────────── */
function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const body    = rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
  const blob    = new Blob([headers + '\n' + body], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
