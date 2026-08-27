/**
 * API + launch config for user portal.
 */

const STORAGE_KEY = 'us_pizza_api_base';

export function resolveApiBaseUrl() {
  if (typeof window.__US_PIZZA_API_BASE__ === 'string' && window.__US_PIZZA_API_BASE__) {
    return window.__US_PIZZA_API_BASE__.replace(/\/$/, '');
  }

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('apiBase') || params.get('api_base');
  if (fromQuery) {
    const normalized = fromQuery.replace(/\/$/, '');
    sessionStorage.setItem(STORAGE_KEY, normalized);
    return normalized;
  }

  const cached = sessionStorage.getItem(STORAGE_KEY);
  if (cached) return cached.replace(/\/$/, '');

  // Same Render/host deploy — API and portal share one origin
  if (typeof window !== 'undefined' && window.location?.origin) {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return window.location.origin.replace(/\/$/, '');
    }
  }

  return 'http://localhost:3000';
}

export const API_BASE_URL = resolveApiBaseUrl();

export function buildApiUrl(path) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

export function readLaunchContext() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get('token') || params.get('access_token') || null,
    userId: params.get('user_id') || params.get('userId') || null,
    guest: params.get('guest') === '1' || params.get('guest') === 'true',
  };
}

export const SUPPORT_MENU = [
  { id: 'find_outlet', emoji: '📍', label: 'Find an Outlet' },
  { id: 'order_status', emoji: '🛵', label: 'Order Status' },
  { id: 'order_issue', emoji: '🧾', label: 'Order Issue / Complaint' },
  { id: 'menu', emoji: '🍕', label: 'Menu' },
  { id: 'promotions', emoji: '🏷️', label: 'Promotions & Offers' },
  { id: 'other', emoji: '💬', label: 'Other / Talk to Support', meta: 'Opens your saved live agent conversation' },
];

export const BOT_MENU = SUPPORT_MENU.filter((item) => item.id !== 'other');

export const COMPLAINT_CATEGORIES = [
  { value: 'wrong_order', label: 'Wrong Order' },
  { value: 'late_delivery', label: 'Late Delivery' },
  { value: 'food_quality', label: 'Food Quality' },
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other' },
];
