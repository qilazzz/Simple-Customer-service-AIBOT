const crypto = require('crypto');
const db = require('../db/knex');

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

/** @type {Map<string, { userId: string, expiresAt: number }>} */
const customerSessions = new Map();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash?.includes(':')) return false;
  const [salt, hash] = storedHash.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch {
    return false;
  }
}

function createToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  customerSessions.set(token, { userId, expiresAt: Date.now() + SESSION_MS });
  return token;
}

function verifyToken(token) {
  if (!token) return null;
  const session = customerSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    customerSessions.delete(token);
    return null;
  }
  return session.userId;
}

function revokeToken(token) {
  customerSessions.delete(token);
}

function formatProfile(row) {
  if (!row) return null;
  return {
    user_id: row.user_id,
    name: row.name,
    email: row.email,
    phone_number: row.phone_number,
    created_at: row.created_at,
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * @param {{ name: string, email: string, password: string, phone_number?: string }} data
 */
async function registerCustomer(data) {
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  const phone = data.phone_number ? String(data.phone_number).trim() : null;

  if (!name || name.length < 2) {
    const error = new Error('Please enter your full name.');
    error.statusCode = 400;
    throw error;
  }

  if (!isValidEmail(email)) {
    const error = new Error('Please enter a valid email address.');
    error.statusCode = 400;
    throw error;
  }

  if (password.length < 6) {
    const error = new Error('Password must be at least 6 characters.');
    error.statusCode = 400;
    throw error;
  }

  const existing = await db('profile').where({ email }).first();
  if (existing?.password_hash) {
    const error = new Error('An account with this email already exists. Please log in.');
    error.statusCode = 409;
    throw error;
  }

  const userId = crypto.randomUUID();
  const passwordHash = hashPassword(password);

  if (existing) {
    await db('profile').where({ user_id: existing.user_id }).update({
      name,
      email,
      phone_number: phone,
      password_hash: passwordHash,
      updated_at: db.fn.now(),
    });

    const row = await db('profile').where({ user_id: existing.user_id }).first();
    const token = createToken(row.user_id);
    return { token, user: formatProfile(row) };
  }

  await db('profile').insert({
    user_id: userId,
    name,
    email,
    phone_number: phone,
    password_hash: passwordHash,
  });

  const row = await db('profile').where({ user_id: userId }).first();
  const token = createToken(userId);
  return { token, user: formatProfile(row) };
}

/**
 * @param {{ email: string, password: string }} data
 */
async function loginCustomer(data) {
  const rawIdentifier = String(data.email || data.identifier || '').trim();
  const password = String(data.password || '');

  if (!rawIdentifier || !password) {
    const error = new Error('Email or phone number and password are required.');
    error.statusCode = 400;
    throw error;
  }

  let row;
  if (rawIdentifier.includes('@')) {
    row = await db('profile').where({ email: rawIdentifier.toLowerCase() }).first();
  } else {
    row = await db('profile').where({ phone_number: rawIdentifier }).first();
  }

  if (!row?.password_hash || !verifyPassword(password, row.password_hash)) {
    const error = new Error('Invalid email, phone number, or password.');
    error.statusCode = 401;
    throw error;
  }

  const token = createToken(row.user_id);
  return { token, user: formatProfile(row) };
}

async function getCustomerById(userId) {
  const row = await db('profile').where({ user_id: userId }).first();
  if (!row?.password_hash) return null;
  return formatProfile(row);
}

module.exports = {
  registerCustomer,
  loginCustomer,
  getCustomerById,
  verifyToken,
  revokeToken,
  createToken,
};
