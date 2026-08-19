const crypto = require('crypto');

/** @type {Map<string, { id: string, createdAt: number, collected: Object, messages: Array<{role: string, text: string}> }>} */
const sessions = new Map();

const SESSION_TTL_MS = 60 * 60 * 1000;

function purgeExpired() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

function createSession(sessionId = null) {
  purgeExpired();
  const id = sessionId || crypto.randomUUID();
  sessions.set(id, {
    id,
    createdAt: Date.now(),
    flow: 'menu',
    stage: 'menu',
    collected: {},
    messages: [],
    pendingFiles: [],
    photoPromptShown: false,
  });
  return id;
}

function getOrCreateSession(sessionId) {
  purgeExpired();
  if (sessions.has(sessionId)) return sessions.get(sessionId);
  createSession(sessionId);
  return sessions.get(sessionId);
}

function getSession(sessionId) {
  purgeExpired();
  return sessions.get(sessionId) || null;
}

function appendMessage(sessionId, role, text) {
  const session = getSession(sessionId);
  if (!session) return null;
  session.messages.push({ role, text, at: Date.now() });
  return session;
}

function updateCollected(sessionId, fields) {
  const session = getSession(sessionId);
  if (!session) return null;
  session.collected = { ...session.collected, ...fields };
  return session;
}

function addPendingFiles(sessionId, files) {
  const session = getSession(sessionId);
  if (!session) return null;
  session.pendingFiles.push(...files);
  return session;
}

function getConversationText(session) {
  return session.messages.map((m) => `${m.role}: ${m.text}`).join('\n');
}

function destroySession(sessionId) {
  sessions.delete(sessionId);
}

module.exports = {
  createSession,
  getOrCreateSession,
  getSession,
  appendMessage,
  updateCollected,
  addPendingFiles,
  getConversationText,
  destroySession,
};
