import { buildApiUrl, readLaunchContext } from './config.js';

const TOKEN_KEY = 'customer_token';
const USER_KEY = 'customer_user';

let cachedUser = null;

export function getCustomerToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCustomerUser() {
  if (cachedUser) return cachedUser;
  try {
    const raw = localStorage.getItem(USER_KEY);
    cachedUser = raw ? JSON.parse(raw) : null;
    return cachedUser;
  } catch {
    return null;
  }
}

export function getCustomerUserId() {
  const user = getCustomerUser();
  if (user?.user_id) return user.user_id;
  if (user?.id) return user.id;
  const params = new URLSearchParams(window.location.search);
  return params.get('user_id') || params.get('userId') || 'guest';
}

export function setCustomerSession(token, user = null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) {
    cachedUser = user;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearCustomerSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  cachedUser = null;
}

export function customerAuthHeaders(extra = {}) {
  const token = getCustomerToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

export function isAuthenticated() {
  return Boolean(getCustomerToken());
}

export function hydrateAuthFromUrl() {
  const { token, userId } = readLaunchContext();
  if (!token) return null;

  const existing = getCustomerUser();
  setCustomerSession(
    token,
    existing || (userId ? { user_id: userId, id: userId } : null),
  );
  return { token, user: getCustomerUser() };
}

export async function refreshCustomerSession() {
  const token = getCustomerToken();
  if (!token) return null;

  try {
    const res = await fetch(buildApiUrl('/api/auth/session-check'), {
      headers: customerAuthHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (data.success && data.authenticated) {
      setCustomerSession(token, data.user);
      return data.user;
    }
    clearCustomerSession();
  } catch {
    return getCustomerUser();
  }
  return null;
}

export async function bootstrapCustomerAuth() {
  hydrateAuthFromUrl();
  if (getCustomerToken()) {
    await refreshCustomerSession();
  }
  return {
    user: getCustomerUser(),
    isAuthenticated: isAuthenticated(),
  };
}

export function getFirstName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}
