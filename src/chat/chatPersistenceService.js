const db = require('../db/knex');
const { createSession, getSession } = require('../complaints/chatSessionStore');
const liveChatService = require('../liveChat/liveChatService');

const ACTIVE_STATUSES = ['WAITING_FOR_AGENT', 'AGENT_CONNECTED'];

function mapMemoryRoleToSenderType(role) {
  if (role === 'customer') return 'user';
  if (role === 'ai') return 'ai';
  return role;
}

function mapSenderTypeToMemoryRole(senderType) {
  if (senderType === 'user') return 'customer';
  if (senderType === 'ai' || senderType === 'bot' || senderType === 'admin') return 'ai';
  return 'ai';
}

function formatHistoryMessage(row) {
  return {
    id: row.id,
    sender_type: row.sender_type,
    sender: row.sender_type,
    message_text: row.message_text,
    created_at: row.created_at,
    timestamp: row.created_at,
    is_admin: row.sender_type === 'admin',
    live_message_id: row.source_live_message_id || null,
  };
}

async function ensureTables() {
  const hasSessions = await db.schema.hasTable('chat_sessions');
  const hasMessages = await db.schema.hasTable('chat_messages');
  return hasSessions && hasMessages;
}

async function getActiveSessionRow(userId) {
  if (!userId || !(await ensureTables())) return null;

  let row = await db('chat_sessions')
    .where({ user_id: userId, status: 'active' })
    .orderBy('updated_at', 'desc')
    .first();

  if (row) return row;

  const liveRow = await db('live_chat_sessions')
    .where({ user_id: userId })
    .whereIn('status', ACTIVE_STATUSES)
    .orderBy('updated_at', 'desc')
    .first();

  if (!liveRow) return null;

  await createPersistedSession(liveRow.chat_session_id, userId, {
    flow: 'live_agent',
    stage: 'live_agent',
    live_session_id: liveRow.id,
  });

  return db('chat_sessions').where({ id: liveRow.chat_session_id }).first();
}

async function createPersistedSession(sessionId, userId, initial = {}) {
  if (!userId || !(await ensureTables())) return null;

  await db('chat_sessions').insert({
    id: sessionId,
    user_id: userId,
    flow: initial.flow || 'menu',
    stage: initial.stage || 'menu',
    live_session_id: initial.live_session_id || null,
    status: 'active',
    collected: initial.collected ? JSON.stringify(initial.collected) : null,
  });

  return getActiveSessionRow(userId);
}

async function updatePersistedSession(sessionId, patch = {}) {
  if (!(await ensureTables())) return;

  const update = { updated_at: db.fn.now() };

  if (patch.flow !== undefined) update.flow = patch.flow;
  if (patch.stage !== undefined) update.stage = patch.stage;
  if (patch.live_session_id !== undefined) update.live_session_id = patch.live_session_id;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.collected !== undefined) {
    update.collected = JSON.stringify(patch.collected || {});
  }

  await db('chat_sessions').where({ id: sessionId }).update(update);
}

async function appendPersistedMessage(sessionId, senderType, messageText, options = {}) {
  if (!(await ensureTables())) return null;

  const text = String(messageText || '').trim();
  if (!text) return null;

  if (options.source_live_message_id) {
    const existing = await db('chat_messages')
      .where({
        session_id: sessionId,
        source_live_message_id: options.source_live_message_id,
      })
      .first();

    if (existing) return existing.id;
  }

  const [messageId] = await db('chat_messages').insert({
    session_id: sessionId,
    sender_type: senderType,
    message_text: text,
    source_live_message_id: options.source_live_message_id || null,
  });

  await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });

  return messageId;
}

async function syncLiveMessagesForSession(sessionRow) {
  if (!sessionRow?.id || !(await ensureTables())) return;

  const liveRow = await db('live_chat_sessions')
    .where({ chat_session_id: sessionRow.id })
    .orderBy('id', 'desc')
    .first();

  if (!liveRow) return;

  const liveMessages = await db('live_chat_messages')
    .where({ live_session_id: liveRow.id })
    .orderBy('created_at', 'asc');

  for (const message of liveMessages) {
    await appendPersistedMessage(sessionRow.id, message.sender, message.message_text, {
      source_live_message_id: message.id,
    });
  }

  if (liveRow.status === 'RESOLVED') {
    await updatePersistedSession(sessionRow.id, {
      flow: 'menu',
      stage: 'menu',
      live_session_id: null,
    });
    return;
  }

  await updatePersistedSession(sessionRow.id, {
    flow: 'live_agent',
    stage: 'live_agent',
    live_session_id: liveRow.id,
  });
}

async function getLastLiveMessageId(chatSessionId) {
  const liveRow = await db('live_chat_sessions')
    .where({ chat_session_id: chatSessionId })
    .orderBy('id', 'desc')
    .first();

  if (!liveRow) return 0;

  const [result] = await db('live_chat_messages')
    .where({ live_session_id: liveRow.id })
    .max('id as max_id');

  return Number(result?.max_id) || 0;
}

async function getSessionMessages(sessionId) {
  if (!(await ensureTables())) return [];

  const rows = await db('chat_messages')
    .where({ session_id: sessionId })
    .orderBy('created_at', 'asc');

  return rows.map(formatHistoryMessage);
}

function restoreMemorySession(sessionRow, messages = []) {
  createSession(sessionRow.id);
  const session = getSession(sessionRow.id);
  if (!session) return null;

  session.userId = sessionRow.user_id;
  session.flow = sessionRow.flow || 'menu';
  session.stage = sessionRow.stage || 'menu';
  session.liveSessionId = sessionRow.live_session_id || null;
  session.collected = sessionRow.collected
    ? typeof sessionRow.collected === 'string'
      ? JSON.parse(sessionRow.collected)
      : sessionRow.collected
    : {};

  session.messages = messages.map((message) => ({
    role: mapSenderTypeToMemoryRole(message.sender_type),
    text: message.message_text,
    at: new Date(message.created_at).getTime(),
  }));

  if (session.flow === 'live_agent' && session.liveSessionId) {
    session.liveStatus = 'AGENT_CONNECTED';
  }

  return session;
}

async function buildHistoryPayload(userId) {
  const sessionRow = await getActiveSessionRow(userId);
  if (!sessionRow) {
    return { found: false };
  }

  await syncLiveMessagesForSession(sessionRow);

  const refreshedRow =
    (await db('chat_sessions').where({ id: sessionRow.id }).first()) || sessionRow;
  const messages = await getSessionMessages(refreshedRow.id);
  const lastLiveMessageId = await getLastLiveMessageId(refreshedRow.id);

  restoreMemorySession(refreshedRow, messages);

  const liveAgent =
    refreshedRow.flow === 'live_agent' &&
    refreshedRow.live_session_id &&
    (await db('live_chat_sessions')
      .where({ id: refreshedRow.live_session_id })
      .whereIn('status', ACTIVE_STATUSES)
      .first());

  let waitingForAgent = false;
  if (liveAgent) {
    waitingForAgent = liveAgent.status === 'WAITING_FOR_AGENT';
  }

  return {
    found: true,
    sessionId: refreshedRow.id,
    messages,
    flow: refreshedRow.flow || 'menu',
    stage: refreshedRow.stage || 'menu',
    live_agent: Boolean(liveAgent),
    live_session_id: refreshedRow.live_session_id || null,
    last_live_message_id: lastLiveMessageId,
    waiting_for_agent: waitingForAgent,
    show_menu: false,
  };
}

async function persistMemoryMessage(sessionId, role, text) {
  const session = getSession(sessionId);
  if (!session?.userId) return;

  let row = await db('chat_sessions').where({ id: sessionId }).first();
  if (!row) {
    await createPersistedSession(sessionId, session.userId, {
      flow: session.flow,
      stage: session.stage,
      live_session_id: session.liveSessionId || null,
      collected: session.collected,
    });
  } else {
    await updatePersistedSession(sessionId, {
      flow: session.flow,
      stage: session.stage,
      live_session_id: session.liveSessionId || null,
      collected: session.collected,
    });
  }

  await appendPersistedMessage(sessionId, mapMemoryRoleToSenderType(role), text);
}

async function closePersistedSession(sessionId) {
  if (!(await ensureTables())) return;
  await updatePersistedSession(sessionId, { status: 'closed' });
}

module.exports = {
  ensureTables,
  getActiveSessionRow,
  createPersistedSession,
  updatePersistedSession,
  appendPersistedMessage,
  syncLiveMessagesForSession,
  getSessionMessages,
  restoreMemorySession,
  buildHistoryPayload,
  persistMemoryMessage,
  closePersistedSession,
  getLastLiveMessageId,
  formatHistoryMessage,
};
