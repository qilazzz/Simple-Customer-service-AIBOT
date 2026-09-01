/**
 * Resolves API_BASE_URL for WebView / standalone browser contexts.
 *
 * Priority:
 * 1. window.__US_PIZZA_API_BASE__ (native inject)
 * 2. ?apiBase= query param (persisted to sessionStorage)
 * 3. sessionStorage cached value
 * 4. Same-origin (empty string → relative /api/*)
 * 5. http://localhost:3000 fallback for local dev
 */

const STORAGE_KEY = 'us_pizza_api_base';

function normalizeBaseUrl(value) {
  if (!value) return '';
  return String(value).replace(/\/$/, '');
}

function readQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function resolveApiBaseUrl() {
  if (typeof window.__US_PIZZA_API_BASE__ === 'string' && window.__US_PIZZA_API_BASE__) {
    return normalizeBaseUrl(window.__US_PIZZA_API_BASE__);
  }

  const fromQuery =
    readQueryParam('apiBase') ||
    readQueryParam('api_base') ||
    readQueryParam('API_BASE_URL');

  if (fromQuery) {
    const normalized = normalizeBaseUrl(fromQuery);
    sessionStorage.setItem(STORAGE_KEY, normalized);
    return normalized;
  }

  const cached = sessionStorage.getItem(STORAGE_KEY);
  if (cached) {
    return normalizeBaseUrl(cached);
  }

  if (window.location.port && window.location.port !== '3000') {
    return 'http://localhost:3000';
  }

  return '';
}

export const API_BASE_URL = resolveApiBaseUrl();

export function buildApiUrl(path) {
  const base = API_BASE_URL;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function readLaunchContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get('token') || params.get('access_token') || null,
    userId: params.get('user_id') || params.get('userId') || null,
    guest: params.get('guest') === '1' || params.get('guest') === 'true',
    apiBase: params.get('apiBase') || params.get('api_base') || null,
  };
}
