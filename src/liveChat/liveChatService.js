const db = require('../db/knex');
const { notifyLiveChatUpdate } = require('./liveChatHub');
const { getSession } = require('../complaints/chatSessionStore');

const ACTIVE_STATUSES = ['WAITING_FOR_AGENT', 'AGENT_CONNECTED'];
const VIEW_STATUSES = {
  active: ACTIVE_STATUSES,
  resolved: ['RESOLVED'],
  trash: ['DELETED'],
};

function formatStatusLabel(status) {
  switch (status) {
    case 'WAITING_FOR_AGENT':
      return 'Waiting for Agent';
    case 'AGENT_CONNECTED':
      return 'In Progress';
    case 'RESOLVED':
      return 'Resolved';
    case 'DELETED':
      return 'Deleted';
    default:
      return status;
  }
}

/**
 * @param {Object} row
 * @param {Object} [profile]
 */
function formatSession(row, profile = null) {
  const customerName =
    row.customer_name ||
    profile?.name ||
    'Guest / Unregistered User';
  const customerContact =
    row.customer_contact ||
    profile?.email ||
    profile?.phone_number ||
    '-';

  return {
    id: row.id,
    chat_session_id: row.chat_session_id,
    user_id: row.user_id,
    status: row.status,
    status_label: formatStatusLabel(row.status),
    customer_name: customerName,
    customer_contact: customerContact,
    outlet_name: row.outlet_name || null,
    assigned_agent: row.assigned_agent,
    unread_count: Number(row.unread_count) || 0,
    last_message: row.last_message || '',
    last_message_at: row.last_message_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function resolveProfile(userId) {
  if (!userId) return null;
  const hasProfile = await db.schema.hasTable('profile');
  if (!hasProfile) return null;
  return db('profile').where({ user_id: userId }).first();
}

function mapSender(role) {
  if (role === 'customer' || role === 'user') return 'user';
  if (role === 'admin') return 'admin';
  return 'bot';
}

async function buildLiveChatListQuery(statuses, filters = {}) {
  const hasProfile = await db.schema.hasTable('profile');

  let query = db('live_chat_sessions as s')
    .whereIn('s.status', statuses)
    .select('s.*');

  if (hasProfile) {
    query = query
      .leftJoin('profile as p', 's.user_id', 'p.user_id')
      .select(
        's.*',
        'p.name as profile_name',
        'p.email as profile_email',
        'p.phone_number as profile_phone',
      );
  }

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    query = query.where(function searchLiveChats() {
      this.where('s.customer_name', 'like', term)
        .orWhere('s.customer_contact', 'like', term)
        .orWhere('s.last_message', 'like', term);
      if (hasProfile) {
        this.orWhere('p.name', 'like', term)
          .orWhere('p.email', 'like', term)
          .orWhere('p.phone_number', 'like', term);
      }
    });
  }

  const rows = await query.orderBy('s.updated_at', 'desc');

  return rows.map((row) =>
    formatSession(row, {
      name: row.profile_name,
      email: row.profile_email,
      phone_number: row.profile_phone,
    }),
  );
}

async function listLiveChatsByView(view = 'active', filters = {}) {
  const statuses = VIEW_STATUSES[view] || VIEW_STATUSES.active;
  return buildLiveChatListQuery(statuses, filters);
}

async function listActiveLiveChats(filters = {}) {
  return listLiveChatsByView('active', filters);
}

async function countChatsByView(view) {
  const statuses = VIEW_STATUSES[view];
  if (!statuses) return 0;
  const [result] = await db('live_chat_sessions')
    .whereIn('status', statuses)
    .count('* as count');
  return Number(result.count) || 0;
}

async function countDeletedChats() {
  return countChatsByView('trash');
}

async function getLiveChatSessionById(id) {
  const row = await db('live_chat_sessions').where({ id }).first();
  if (!row) return null;

  const profile = await resolveProfile(row.user_id);
  const session = formatSession(row, profile);
  const messages = await db('live_chat_messages')
    .where({ live_session_id: id })
    .orderBy('created_at', 'asc');

  session.messages = messages.map(formatLiveMessage);

  return session;
}

function formatLiveMessage(message) {
  return {
    id: message.id,
    sender: message.sender,
    sender_type: message.sender,
    message_text: message.message_text,
    created_at: message.created_at,
    timestamp: message.created_at,
    is_admin: message.sender === 'admin',
  };
}

function getLastMessageId(messages = []) {
  if (!messages.length) return 0;
  return Math.max(...messages.map((message) => Number(message.id) || 0));
}

async function getLiveChatByChatSessionId(chatSessionId) {
  const row = await db('live_chat_sessions')
    .where({ chat_session_id: chatSessionId })
    .whereIn('status', ACTIVE_STATUSES)
    .first();
  if (!row) return null;
  return getLiveChatSessionById(row.id);
}

async function getLatestLiveChatByChatSessionId(chatSessionId) {
  const row = await db('live_chat_sessions')
    .where({ chat_session_id: chatSessionId })
    .orderBy('id', 'desc')
    .first();
  if (!row) return null;
  return getLiveChatSessionById(row.id);
}

async function reopenLiveChatSession(liveSessionId, { incrementUnread = false } = {}) {
  const session = await db('live_chat_sessions').where({ id: liveSessionId }).first();
  if (!session) {
    const error = new Error('Live chat session not found.');
    error.statusCode = 404;
    throw error;
  }

  if (!['RESOLVED', 'DELETED'].includes(session.status)) {
    return session;
  }

  const previousStatus = session.status;
  const updateData = {
    status: 'WAITING_FOR_AGENT',
    assigned_agent: null,
    updated_at: db.fn.now(),
  };

  if (incrementUnread) {
    updateData.unread_count = (Number(session.unread_count) || 0) + 1;
  } else {
    updateData.unread_count = 0;
  }

  await db('live_chat_sessions').where({ id: liveSessionId }).update(updateData);

  const chatSession = getSession(session.chat_session_id);
  if (chatSession) {
    chatSession.flow = 'live_agent';
    chatSession.stage = 'live_agent';
    chatSession.liveSessionId = liveSessionId;
    chatSession.liveStatus = 'WAITING_FOR_AGENT';
  }

  try {
    const chatPersistence = require('../chat/chatPersistenceService');
    await chatPersistence.updatePersistedSession(session.chat_session_id, {
      flow: 'live_agent',
      stage: 'live_agent',
      live_session_id: liveSessionId,
    });
  } catch {
    // Persistence is best-effort.
  }

  notifyLiveChatUpdate({
    type: 'reopened',
    liveSessionId,
    chatSessionId: session.chat_session_id,
    previousStatus,
  });

  return db('live_chat_sessions').where({ id: liveSessionId }).first();
}

async function countWaitingChats() {
  const [result] = await db('live_chat_sessions')
    .where({ status: 'WAITING_FOR_AGENT' })
    .count('* as count');
  return Number(result.count) || 0;
}

/**
 * @param {Object} params
 * @param {string} params.chatSessionId
 * @param {string} [params.userId]
 * @param {string} [params.customerName]
 * @param {string} [params.customerContact]
 * @param {string} [params.outletName]
 * @param {Array<{role: string, text: string}>} [params.history]
 */
async function createOrGetLiveChatSession(params) {
  const existing = await db('live_chat_sessions')
    .where({ chat_session_id: params.chatSessionId })
    .whereIn('status', ACTIVE_STATUSES)
    .first();

  if (existing) {
    return getLiveChatSessionById(existing.id);
  }

  const closed = await db('live_chat_sessions')
    .where({ chat_session_id: params.chatSessionId })
    .whereIn('status', ['RESOLVED', 'DELETED'])
    .orderBy('id', 'desc')
    .first();

  if (closed) {
    await reopenLiveChatSession(closed.id);
    return getLiveChatSessionById(closed.id);
  }

  const profile = await resolveProfile(params.userId);

  const [liveSessionId] = await db('live_chat_sessions').insert({
    chat_session_id: params.chatSessionId,
    user_id: params.userId || null,
    status: 'WAITING_FOR_AGENT',
    customer_name: params.customerName || profile?.name || null,
    customer_contact:
      params.customerContact ||
      profile?.email ||
      profile?.phone_number ||
      null,
    outlet_name: params.outletName || null,
    unread_count: 0,
  });

  if (params.history?.length) {
    await db('live_chat_messages').insert(
      params.history.map((entry) => ({
        live_session_id: liveSessionId,
        sender: mapSender(entry.role),
        message_text: entry.text,
      })),
    );

    const last = params.history[params.history.length - 1];
    await db('live_chat_sessions')
      .where({ id: liveSessionId })
      .update({
        last_message: last.text,
        last_message_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
  }

  notifyLiveChatUpdate({ type: 'new_session', liveSessionId });
  return getLiveChatSessionById(liveSessionId);
}

async function addLiveChatMessage(liveSessionId, sender, messageText, { incrementUnread = false } = {}) {
  let session = await db('live_chat_sessions').where({ id: liveSessionId }).first();
  if (!session) {
    const error = new Error('Live chat session not found.');
    error.statusCode = 404;
    throw error;
  }

  let reopened = false;

  if (['RESOLVED', 'DELETED'].includes(session.status)) {
    if (sender !== 'user') {
      const error = new Error('This live chat session is closed.');
      error.statusCode = 400;
      throw error;
    }

    session = await reopenLiveChatSession(liveSessionId, { incrementUnread });
    reopened = true;
  }

  const [messageId] = await db('live_chat_messages').insert({
    live_session_id: liveSessionId,
    sender,
    message_text: messageText,
  });

  const updateData = {
    last_message: messageText,
    last_message_at: db.fn.now(),
    updated_at: db.fn.now(),
  };

  if (incrementUnread && sender === 'user' && !reopened) {
    updateData.unread_count = (Number(session.unread_count) || 0) + 1;
  }

  if (sender === 'admin' && session.status === 'WAITING_FOR_AGENT') {
    updateData.status = 'AGENT_CONNECTED';
  }

  await db('live_chat_sessions').where({ id: liveSessionId }).update(updateData);

  try {
    const chatPersistence = require('../chat/chatPersistenceService');
    const nextStatus = updateData.status || session.status;
    await chatPersistence.appendPersistedMessage(session.chat_session_id, sender, messageText, {
      source_live_message_id: messageId,
    });
    await chatPersistence.updatePersistedSession(session.chat_session_id, {
      flow: 'live_agent',
      stage: 'live_agent',
      live_session_id: liveSessionId,
    });
  } catch {
    // Persistence is best-effort; live chat still works in memory.
  }

  notifyLiveChatUpdate({
    type: 'message',
    liveSessionId,
    sender,
    chatSessionId: session.chat_session_id,
    reopened,
  });

  return {
    id: messageId,
    live_session_id: liveSessionId,
    sender,
    sender_type: sender,
    message_text: messageText,
    created_at: new Date(),
    timestamp: new Date(),
    is_admin: sender === 'admin',
  };
}

async function claimLiveChatSession(id, agentName = 'admin') {
  const session = await db('live_chat_sessions').where({ id }).first();
  if (!session) {
    const error = new Error('Live chat session not found.');
    error.statusCode = 404;
    throw error;
  }

  if (session.status === 'RESOLVED' || session.status === 'DELETED') {
    const error = new Error('This session is closed.');
    error.statusCode = 400;
    throw error;
  }

  await db('live_chat_sessions')
    .where({ id })
    .update({
      status: 'AGENT_CONNECTED',
      assigned_agent: agentName,
      unread_count: 0,
      updated_at: db.fn.now(),
    });

  notifyLiveChatUpdate({ type: 'claimed', liveSessionId: id });
  return getLiveChatSessionById(id);
}

async function markLiveChatRead(id) {
  await db('live_chat_sessions')
    .where({ id })
    .update({ unread_count: 0, updated_at: db.fn.now() });
}

async function resolveLiveChatSession(id) {
  const session = await db('live_chat_sessions').where({ id }).first();
  if (!session) {
    const error = new Error('Live chat session not found.');
    error.statusCode = 404;
    throw error;
  }

  if (session.status === 'DELETED') {
    const error = new Error('This session has been deleted.');
    error.statusCode = 400;
    throw error;
  }

  if (session.status === 'RESOLVED') {
    const error = new Error('This session is already resolved.');
    error.statusCode = 400;
    throw error;
  }

  const closingMessage =
    'This support session has ended. You can continue using our chatbot anytime. Thank you for contacting US Pizza Malaysia.';

  await db('live_chat_messages').insert({
    live_session_id: id,
    sender: 'bot',
    message_text: closingMessage,
  });

  await db('live_chat_sessions')
    .where({ id })
    .update({
      status: 'RESOLVED',
      unread_count: 0,
      last_message: closingMessage,
      last_message_at: db.fn.now(),
      updated_at: db.fn.now(),
    });

  notifyLiveChatUpdate({
    type: 'resolved',
    liveSessionId: id,
    chatSessionId: session.chat_session_id,
  });

  const chatSession = getSession(session.chat_session_id);
  if (chatSession) {
    chatSession.flow = 'menu';
    chatSession.stage = 'menu';
    chatSession.liveSessionId = null;
    chatSession.liveStatus = null;
  }

  return getLiveChatSessionById(id);
}

async function getLiveChatUpdatesForCustomer(chatSessionId, sinceId = 0) {
  const row = await db('live_chat_sessions')
    .where({ chat_session_id: chatSessionId })
    .orderBy('id', 'desc')
    .first();

  if (!row) {
    return { live_agent: false, resolved: false, messages: [] };
  }

  let query = db('live_chat_messages')
    .where({ live_session_id: row.id })
    .orderBy('created_at', 'asc');

  if (sinceId) {
    query = query.where('id', '>', Number(sinceId));
  }

  const messages = await query;

  const formatted = messages.map(formatLiveMessage);

  return {
    live_session_id: row.id,
    status: row.status,
    live_agent: !['RESOLVED', 'DELETED'].includes(row.status),
    resolved: row.status === 'RESOLVED' || row.status === 'DELETED',
    last_message_id: getLastMessageId(formatted),
    messages: formatted,
  };
}

async function moveLiveChatsToTrash(ids = []) {
  const normalizedIds = [...new Set(ids.map((id) => Number(id)).filter(Boolean))];
  if (!normalizedIds.length) {
    const error = new Error('No chat sessions selected.');
    error.statusCode = 400;
    throw error;
  }

  const sessions = await db('live_chat_sessions')
    .whereIn('id', normalizedIds)
    .whereNot({ status: 'DELETED' });

  if (!sessions.length) {
    const error = new Error('No eligible chat sessions found.');
    error.statusCode = 404;
    throw error;
  }

  const sessionIds = sessions.map((session) => session.id);

  await db('live_chat_sessions')
    .whereIn('id', sessionIds)
    .update({
      status: 'DELETED',
      unread_count: 0,
      updated_at: db.fn.now(),
    });

  sessionIds.forEach((liveSessionId) => {
    notifyLiveChatUpdate({ type: 'deleted', liveSessionId });
  });

  return sessionIds.length;
}

async function moveAllLiveChatsToTrash(view) {
  const statuses = VIEW_STATUSES[view];
  if (!statuses || view === 'trash') {
    const error = new Error('Invalid view for bulk trash action.');
    error.statusCode = 400;
    throw error;
  }

  const rows = await db('live_chat_sessions').whereIn('status', statuses).select('id');
  const ids = rows.map((row) => row.id);
  if (!ids.length) return 0;
  return moveLiveChatsToTrash(ids);
}

async function permanentlyDeleteLiveChats(ids = []) {
  const normalizedIds = [...new Set(ids.map((id) => Number(id)).filter(Boolean))];
  if (!normalizedIds.length) {
    const error = new Error('No chat sessions selected.');
    error.statusCode = 400;
    throw error;
  }

  const sessions = await db('live_chat_sessions')
    .whereIn('id', normalizedIds)
    .where({ status: 'DELETED' });

  if (!sessions.length) {
    const error = new Error('No deleted chat sessions found.');
    error.statusCode = 404;
    throw error;
  }

  const sessionIds = sessions.map((session) => session.id);

  await db('live_chat_messages').whereIn('live_session_id', sessionIds).del();
  await db('live_chat_sessions').whereIn('id', sessionIds).del();

  sessionIds.forEach((liveSessionId) => {
    notifyLiveChatUpdate({ type: 'purged', liveSessionId });
  });

  return sessionIds.length;
}

async function permanentlyDeleteAllInTrash() {
  const rows = await db('live_chat_sessions').where({ status: 'DELETED' }).select('id');
  const ids = rows.map((row) => row.id);
  if (!ids.length) return 0;
  return permanentlyDeleteLiveChats(ids);
}

module.exports = {
  ACTIVE_STATUSES,
  VIEW_STATUSES,
  listActiveLiveChats,
  listLiveChatsByView,
  getLiveChatSessionById,
  getLiveChatByChatSessionId,
  getLatestLiveChatByChatSessionId,
  getLiveChatUpdatesForCustomer,
  countWaitingChats,
  countDeletedChats,
  countChatsByView,
  createOrGetLiveChatSession,
  addLiveChatMessage,
  claimLiveChatSession,
  markLiveChatRead,
  resolveLiveChatSession,
  reopenLiveChatSession,
  moveLiveChatsToTrash,
  moveAllLiveChatsToTrash,
  permanentlyDeleteLiveChats,
  permanentlyDeleteAllInTrash,
};
