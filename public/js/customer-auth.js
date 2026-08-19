const TOKEN_KEY = 'customer_token';
const USER_KEY = 'customer_user';

function getCustomerToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getCustomerUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCustomerSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearCustomerSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function customerAuthHeaders(extra = {}) {
  const token = getCustomerToken();
  return token
    ? { ...extra, Authorization: `Bearer ${token}` }
    : extra;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function logoutCustomer() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: customerAuthHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch {
    // Ignore network errors during logout.
  }
  clearCustomerSession();
}

async function refreshCustomerSession() {
  const token = getCustomerToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/session-check', {
      headers: customerAuthHeaders(),
    });
    const data = await res.json();
    if (!data.success || !data.authenticated) {
      clearCustomerSession();
      return null;
    }
    setCustomerSession(token, data.user);
    return data.user;
  } catch {
    return getCustomerUser();
  }
}
