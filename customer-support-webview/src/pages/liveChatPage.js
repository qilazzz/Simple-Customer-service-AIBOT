/**
 * Live support page — mirrors mobile LiveSupportChat.
 */

import { bootstrapCustomerAuth, getCustomerUserId, isAuthenticated } from '../auth/customerAuth.js';
import { readLaunchContext } from '../config.js';
import { CustomerSupportApi } from '../api/customerSupportApi.js';
import { LiveChatListener } from '../chat/liveChatListener.js';
import { initNativeBridge } from '../bridge/nativeBridge.js';

const messagesEl = document.getElementById('live-messages');
const composeForm = document.getElementById('live-compose');
const inputEl = document.getElementById('live-input');
const sendBtn = document.getElementById('live-send-btn');
const loadingEl = document.getElementById('live-loading');
const panelEl = document.getElementById('live-chat-panel');
const errorEl = document.getElementById('live-error');
const statusEl = document.getElementById('live-status');

const api = new CustomerSupportApi();
const listener = new LiveChatListener(api);
const displayedIds = new Set();

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showError(message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function hideError() {
  errorEl?.classList.add('hidden');
}

function setStatus({ liveAgent, waitingForAgent }) {
  if (!statusEl) return;

  statusEl.classList.remove('is-connected', 'is-waiting', 'is-connecting');

  if (liveAgent && !waitingForAgent) {
    statusEl.textContent = 'Connected';
    statusEl.classList.add('is-connected');
  } else if (waitingForAgent) {
    statusEl.textContent = 'Waiting';
    statusEl.classList.add('is-waiting');
  } else {
    statusEl.textContent = 'Connecting';
    statusEl.classList.add('is-connecting');
  }
}

function appendBubble(text, role) {
  if (!messagesEl || !text) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = text;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function resolveRole(message) {
  const sender = message.sender_type || message.sender;
  if (sender === 'user' || sender === 'customer') return 'user';
  if (sender === 'admin' || message.is_admin) return 'support';
  return 'bot';
}

function ingestLiveMessage(message) {
  if (!message?.id || displayedIds.has(message.id)) return;

  const role = resolveRole(message);
  if (role === 'user') {
    displayedIds.add(message.id);
    return;
  }

  displayedIds.add(message.id);
  appendBubble(message.message_text, role === 'support' ? 'support' : 'bot');
}

async function bootstrapSession() {
  const launch = readLaunchContext();

  if (isAuthenticated()) {
    try {
      const history = await api.getLiveChatHistory();
      if (history.sessionId) {
        api.setSessionId(history.sessionId);
        (history.messages || []).forEach((message) => ingestLiveMessage(message));
        listener.resetCursor(
          (() => {
            const ids = (history.messages || []).map((m) => Number(m.id) || 0);
            return ids.length ? Math.max(...ids) : 0;
          })(),
        );
        return history.sessionId;
      }
    } catch {
      // Fall through to new session.
    }
  }

  if (!isAuthenticated() && !launch.guest) {
    appendBubble('Continuing as guest. Sign in from your host app to restore chat history.', 'system');
  }

  const data = await api.startLiveSession();
  return data.sessionId;
}

async function initLiveChatPage() {
  initNativeBridge();
  await bootstrapCustomerAuth();

  listener.setHandlers({
    onMessage: (payload) => {
      ingestLiveMessage(payload.message);
      setStatus({
        liveAgent: payload.liveAgent,
        waitingForAgent: payload.waitingForAgent,
      });
    },
    onStatusChange: (payload) => {
      setStatus(payload);
    },
    onError: (err) => {
      showError(err.message || 'Live updates interrupted.');
    },
  });

  try {
    const sessionId = await bootstrapSession();
    loadingEl?.classList.add('hidden');
    panelEl?.classList.remove('hidden');
    hideError();
    await listener.start(sessionId);
    setStatus({ liveAgent: false, waitingForAgent: true });
  } catch (err) {
    loadingEl?.classList.add('hidden');
    showError(err.message || 'Could not start live support.');
  }

  composeForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = inputEl?.value.trim();
    if (!text || !api.getSessionId()) return;

    sendBtn.disabled = true;
    try {
      const userId = getCustomerUserId();
      const data = await api.sendMessage(text, userId);
      appendBubble(text, 'user');
      inputEl.value = '';
      (data.new_messages || []).forEach((message) => ingestLiveMessage(message));
      setStatus({
        liveAgent: data.live_agent,
        waitingForAgent: data.waiting_for_agent,
      });
      hideError();
    } catch (err) {
      showError(err.message || 'Could not send message.');
    } finally {
      sendBtn.disabled = false;
      inputEl?.focus();
    }
  });

  window.addEventListener('beforeunload', () => listener.stop());
}

initLiveChatPage();
