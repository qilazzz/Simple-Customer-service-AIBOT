import { API_BASE_URL } from '../support/config';

function buildUrl(path) {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

async function parseResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

export async function loginCustomer(identifier, password) {
  const res = await fetch(buildUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: identifier.trim(), password }),
  });
  return parseResponse(res);
}

export async function registerCustomer({ name, email, password, phone_number }) {
  const res = await fetch(buildUrl('/api/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim(),
      password,
      phone_number: phone_number?.trim() || null,
    }),
  });
  return parseResponse(res);
}

export async function logoutCustomer(token) {
  try {
    await fetch(buildUrl('/api/auth/logout'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    // Ignore network errors during logout.
  }
}

export async function checkCustomerSession(token) {
  const res = await fetch(buildUrl('/api/auth/session-check'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseResponse(res);
}
