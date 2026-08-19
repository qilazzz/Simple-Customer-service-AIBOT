const crypto = require('crypto');

/** @type {Map<string, { token: string, expiresAt: number }>} */
const adminSessions = new Map();

const SESSION_MS = 8 * 60 * 60 * 1000;

function login(password) {
  const expected = process.env.ADMIN_PASSWORD || 'admin123';
  if (password !== expected) return null;

  const token = crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, { token, expiresAt: Date.now() + SESSION_MS });
  return token;
}

function verifyToken(token) {
  if (!token) return false;
  const session = adminSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token =
    (header.startsWith('Bearer ') ? header.slice(7) : null) ||
    req.headers['x-admin-token'] ||
    req.query.token;

  if (!verifyToken(token)) {
    return res.status(401).json({ success: false, message: 'Unauthorized. Admin login required.' });
  }

  req.adminToken = token;
  return next();
}

module.exports = { login, verifyToken, requireAdmin };
