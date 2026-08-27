import { buildApiUrl } from './config.js';
import { customerAuthHeaders, setCustomerSession, clearCustomerSession } from './auth.js';

export async function loginCustomer(identifier, password) {
  const res = await fetch(buildApiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: identifier.trim(), password }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Could not log in.');
  setCustomerSession(data.token, data.user);
  return data;
}

export async function registerCustomer(payload) {
  const res = await fetch(buildApiUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: payload.name.trim(),
      email: payload.email.trim(),
      password: payload.password,
      phone_number: payload.phone_number?.trim() || null,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Could not create account.');
  setCustomerSession(data.token, data.user);
  return data;
}

export async function logoutCustomer() {
  try {
    await fetch(buildApiUrl('/api/auth/logout'), {
      method: 'POST',
      headers: customerAuthHeaders({ 'Content-Type': 'application/json' }),
    });
  } catch {
    // Ignore network errors.
  }
  clearCustomerSession();
}

export class OutletsApi {
  async request(path) {
    const res = await fetch(buildApiUrl(path));
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
  }

  listStates() {
    return this.request('/api/outlets/states');
  }

  listOutlets({ state, search } = {}) {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (search) params.set('search', search);
    const qs = params.toString();
    return this.request(`/api/outlets${qs ? `?${qs}` : ''}`);
  }
}
