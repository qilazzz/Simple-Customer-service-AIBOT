const messagesEl = document.getElementById('chat-messages');
const inputEl = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const typingEl = document.getElementById('typing');
const chatUserBar = document.getElementById('chat-user-bar');
const chatGuestBar = document.getElementById('chat-guest-bar');
const chatUserNameEl = document.getElementById('chat-user-name');
const chatLogoutBtn = document.getElementById('chat-logout-btn');
const supportStatusEl = document.getElementById('support-status');
const toolbarStatusEl = document.getElementById('toolbar-status');

let sessionId = null;
let liveAgentMode = true;
let livePollTimer = null;
let lastLiveMessageId = 0;
let waitingForAgent = true;
const displayedLiveMessageIds = new Set();

function getAnalyticsUserId() {
  const user = typeof getCustomerUser === 'function' ? getCustomerUser() : null;
  return user?.user_id || 'guest';
}

function jsonAuthHeaders() {
  if (typeof customerAuthHeaders === 'function') {
    return customerAuthHeaders({ 'Content-Type': 'application/json' });
  }
  return { 'Content-Type': 'application/json' };
}

function updateCustomerBar(user = null) {
  const activeUser = user || (typeof getCustomerUser === 'function' ? getCustomerUser() : null);
  if (activeUser) {
    chatUserBar?.classList.remove('hidden');
    chatGuestBar?.classList.add('hidden');
    if (chatUserNameEl) chatUserNameEl.textContent = activeUser.name || activeUser.email;
  } else {
    chatUserBar?.classList.add('hidden');
    chatGuestBar?.classList.remove('hidden');
  }
}

function updateSupportStatus(data = {}) {
  waitingForAgent = Boolean(data.waiting_for_agent);
  const connected = data.live_agent && !waitingForAgent;
  const label = connected
    ? 'Live Support Connected'
    : waitingForAgent
      ? 'Waiting for Agent'
      : 'Connecting to Support';

  if (supportStatusEl) {
    supportStatusEl.textContent = label;
    supportStatusEl.classList.toggle('is-connected', connected);
    supportStatusEl.classList.toggle('is-waiting', waitingForAgent);
    supportStatusEl.classList.toggle('is-connecting', !connected && !waitingForAgent);
  }

  if (toolbarStatusEl) {
    toolbarStatusEl.textContent = label;
  }
}

function resolveCustomerMessageType(message) {
  const sender = message.sender_type || message.sender;
  if (sender === 'user' || sender === 'customer') return 'user';
  if (sender === 'admin' || message.is_admin) return 'support';
  return 'bot';
}

function syncLiveMessageCursor(messageId) {
  if (!messageId) return;
  lastLiveMessageId = Math.max(lastLiveMessageId, Number(messageId) || 0);
  displayedLiveMessageIds.add(Number(messageId));
}

function formatBotMessage(text) {
  return String(text ?? '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\n---\n[\s\S]*$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function appendMessage(text, type = 'bot') {
  if (!text?.trim()) return;
  const div = document.createElement('div');
  div.className = `msg ${type}`;
  div.textContent = type === 'user' ? text : formatBotMessage(text);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendLiveMessage(message) {
  if (!message?.id || displayedLiveMessageIds.has(message.id)) return;

  const sender = message.sender_type || message.sender;
  if (sender === 'user' || sender === 'customer') {
    syncLiveMessageCursor(message.id);
    return;
  }

  displayedLiveMessageIds.add(message.id);
  lastLiveMessageId = Math.max(lastLiveMessageId, Number(message.id) || 0);
  appendMessage(message.message_text, resolveCustomerMessageType(message));
}

function setTyping(visible) {
  typingEl?.classList.toggle('hidden', !visible);
}

function stopLiveAgentPolling() {
  if (livePollTimer) {
    window.clearInterval(livePollTimer);
    livePollTimer = null;
  }
}

function startLiveAgentPolling() {
  stopLiveAgentPolling();
  livePollTimer = window.setInterval(pollLiveAgentMessages, 1500);
  pollLiveAgentMessages();
}

async function pollLiveAgentMessages() {
  if (!sessionId || !liveAgentMode) return;

  try {
    const params = new URLSearchParams({
      sessionId,
      sinceId: String(lastLiveMessageId || 0),
    });
    const res = await fetch(`/api/chat/live-updates?${params}`);
    const data = await res.json();
    if (!data.success) return;

    if (data.last_message_id) {
      lastLiveMessageId = Math.max(lastLiveMessageId, Number(data.last_message_id) || 0);
    }

    updateSupportStatus({
      live_agent: data.live_agent,
      waiting_for_agent: data.status === 'WAITING_FOR_AGENT',
    });

    if (data.resolved) {
      (data.messages || []).forEach(appendLiveMessage);
      liveAgentMode = true;
      waitingForAgent = data.status === 'WAITING_FOR_AGENT';
      updateSupportStatus({ live_agent: true, waiting_for_agent: waitingForAgent });
      return;
    }

    (data.messages || []).forEach(appendLiveMessage);
  } catch {
    // Ignore transient polling errors.
  }
}

function applySessionPayload(data) {
  sessionId = data.sessionId;
  liveAgentMode = Boolean(data.live_agent);
  updateCustomerBar(data.user || null);
  updateSupportStatus(data);

  if (data.last_live_message_id) {
    syncLiveMessageCursor(data.last_live_message_id);
  }

  if (liveAgentMode) {
    startLiveAgentPolling();
  }
}

function hydrateHistory(data) {
  applySessionPayload(data);

  (data.messages || []).forEach((message) => {
    appendMessage(message.message_text, resolveCustomerMessageType(message));
    if (message.live_message_id) {
      displayedLiveMessageIds.add(Number(message.live_message_id));
      syncLiveMessageCursor(message.live_message_id);
    }
  });

  if (data.last_live_message_id) {
    syncLiveMessageCursor(data.last_live_message_id);
  }

  if (data.reply && !(data.messages || []).some((m) => m.message_text === data.reply)) {
    appendMessage(data.reply, 'bot');
  }
}

async function startSession() {
  if (typeof getCustomerToken === 'function' && getCustomerToken()) {
    try {
      const res = await fetch('/api/chat/history?direct_support=true', {
        headers: jsonAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && data.found) {
        hydrateHistory(data);
        return;
      }
    } catch {
      // Fall through to POST /session.
    }
  }

  const res = await fetch('/api/chat/session', {
    method: 'POST',
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ direct_support: true }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message);

  if (data.resumed && data.messages?.length) {
    hydrateHistory(data);
    return;
  }

  applySessionPayload(data);
  if (data.reply) appendMessage(data.reply, 'bot');
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || !sessionId) return;

  appendMessage(text, 'user');
  inputEl.value = '';
  sendBtn.disabled = true;
  setTyping(true);

  try {
    const res = await fetch('/api/chat/message', {
      method: 'POST',
      headers: jsonAuthHeaders(),
      body: JSON.stringify({
        sessionId,
        message: text,
        user_id: getAnalyticsUserId(),
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    if (data.reply) appendMessage(data.reply, 'bot');
    if (data.last_live_message_id) syncLiveMessageCursor(data.last_live_message_id);
    updateSupportStatus(data);
    if (data.live_agent) {
      liveAgentMode = true;
      startLiveAgentPolling();
    }
  } catch (err) {
    appendMessage(err.message || 'Something went wrong. Please try again.', 'system');
  } finally {
    sendBtn.disabled = false;
    setTyping(false);
  }
}

sendBtn?.addEventListener('click', sendMessage);
inputEl?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

chatLogoutBtn?.addEventListener('click', async () => {
  if (typeof logoutCustomer === 'function') {
    await logoutCustomer();
  }
  updateCustomerBar(null);
  window.location.reload();
});

if (typeof setupMobileKeyboardFix === 'function') {
  setupMobileKeyboardFix({ inputEl, messagesEl });
}

(async () => {
  if (typeof refreshCustomerSession === 'function') {
    await refreshCustomerSession();
    updateCustomerBar();
  }
  startSession().catch((err) => appendMessage(err.message, 'system'));
})();
