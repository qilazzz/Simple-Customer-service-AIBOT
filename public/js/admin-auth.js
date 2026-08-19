const TOKEN_KEY = 'admin_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function adminFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders(),
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/admin/login.html';
    throw new Error('Session expired.');
  }

  return res;
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = '/admin/login.html';
  }
}

function logout() {
  clearToken();
  window.location.href = '/admin/login.html';
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value) {
  return new Date(value).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
}
