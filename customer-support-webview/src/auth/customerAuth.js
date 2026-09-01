/**
 * Customer session storage for WebView — mirrors mobile AsyncStorage keys.
 */

import { buildApiUrl, readLaunchContext } from '../config.js';

const TOKEN_KEY = 'customer_token';
const USER_KEY = 'customer_user';

let cachedUser = null;

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getCustomerToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCustomerUser() {
  if (cachedUser) return cachedUser;
  cachedUser = readStoredUser();
  return cachedUser;
}

export function getCustomerUserId() {
  const user = getCustomerUser();
  return user?.user_id || user?.id || null;
}

export function setCustomerSession(token, user = null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
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

/**
 * Parse ?token=&user_id= from WebView launch URL and persist session.
 */
export function hydrateAuthFromLaunchUrl() {
  const { token, userId } = readLaunchContext();
  if (!token) return null;

  const existing = getCustomerUser();
  const user =
    existing ||
    (userId
      ? {
          user_id: userId,
          id: userId,
        }
      : null);

  setCustomerSession(token, user);
  return { token, user };
}

export async function refreshCustomerSession() {
  const token = getCustomerToken();
  if (!token) return null;

  try {
    const res = await fetch(buildApiUrl('/api/auth/session-check'), {
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

export async function bootstrapCustomerAuth() {
  hydrateAuthFromLaunchUrl();
  if (getCustomerToken()) {
    await refreshCustomerSession();
  }
  return {
    token: getCustomerToken(),
    user: getCustomerUser(),
    isAuthenticated: isAuthenticated(),
  };
}
