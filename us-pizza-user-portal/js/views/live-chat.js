import { getCustomerUser, getCustomerUserId, isAuthenticated } from '../auth.js';
import { CustomerSupportApi } from '../api.js';

function formatReply(text) {
  return String(text ?? '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\n---\n[\s\S]*$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getSupportStatusLabel(waitingForAgent, liveAgent) {
  if (liveAgent && !waitingForAgent) return 'Live Support Connected';
  if (waitingForAgent) return 'Waiting for Agent';
  return 'Connecting to Support';
}

export function createLiveChatController(container, { guestMode = false, onRequestLogin, onLogout } = {}) {
  container.innerHTML = `
    <div class="live-chat-layout">
      <div id="live-inline-status" class="live-inline-status">
        <span id="live-status-dot" class="live-status-dot is-connecting"></span>
        <span id="live-status-text">Connecting to Support</span>
      </div>
      <div id="live-user-bar" class="live-user-bar hidden"></div>
      <div id="live-loading" class="view-loading">Connecting to support…</div>
      <div id="live-panel" class="chat-panel hidden">
        <div id="live-messages" class="chat-messages"></div>
      </div>
      <footer id="live-compose" class="live-compose-dock hidden">
        <form id="live-form" class="live-compose-form">
          <textarea id="live-input" rows="2" placeholder="Type your message..." maxlength="2000"></textarea>
          <button id="live-send-btn" type="submit">Send</button>
        </form>
      </footer>
    </div>
  `;

  const statusDot = container.querySelector('#live-status-dot');
  const statusText = container.querySelector('#live-status-text');
  const userBarEl = container.querySelector('#live-user-bar');
  const messagesEl = container.querySelector('#live-messages');
  const loadingEl = container.querySelector('#live-loading');
  const panelEl = container.querySelector('#live-panel');
  const composeEl = container.querySelector('#live-compose');
  const form = container.querySelector('#live-form');
  const inputEl = container.querySelector('#live-input');
  const sendBtn = container.querySelector('#live-send-btn');

  const api = new CustomerSupportApi();
  let pollTimer = null;
  let lastLiveMessageId = 0;
  let sending = false;
  const displayedIds = new Set();
  let waitingForAgent = true;
  let liveAgentMode = true;

  function renderUserBar() {
    const user = getCustomerUser();
    const showBar = Boolean(user) || guestMode;
    userBarEl.classList.toggle('hidden', !showBar);
    if (!showBar) return;

    if (user && isAuthenticated()) {
      userBarEl.innerHTML = `
        <span class="live-user-bar-text">Signed in as ${user.name}</span>
        <button type="button" class="live-user-bar-action" id="live-logout-btn">Log out</button>
      `;
      userBarEl.querySelector('#live-logout-btn')?.addEventListener('click', () => onLogout?.());
    } else {
      userBarEl.innerHTML = `
        <span class="live-user-bar-text">Continuing as Guest</span>
        <button type="button" class="live-user-bar-action" id="live-login-btn">Log in</button>
      `;
      userBarEl.querySelector('#live-login-btn')?.addEventListener('click', () => onRequestLogin?.());
    }
  }

  function updateStatus(data = {}) {
    waitingForAgent = Boolean(data.waiting_for_agent ?? data.status === 'WAITING_FOR_AGENT');
    liveAgentMode = Boolean(data.live_agent ?? liveAgentMode);

    statusText.textContent = getSupportStatusLabel(waitingForAgent, liveAgentMode);
    statusDot.classList.remove('is-connected', 'is-waiting', 'is-connecting');
    if (liveAgentMode && !waitingForAgent) statusDot.classList.add('is-connected');
    else if (waitingForAgent) statusDot.classList.add('is-waiting');
    else statusDot.classList.add('is-connecting');
  }

  function appendMessage(text, type) {
    if (!messagesEl || !text?.trim()) return;
    const div = document.createElement('div');
    div.className = `msg ${type}`;

    if (type === 'support') {
      const label = document.createElement('span');
      label.className = 'support-label';
      label.textContent = 'Support';
      div.appendChild(label);
    }

    const body = document.createElement('span');
    body.className = 'msg-body';
    body.textContent = formatReply(text);
    div.appendChild(body);

    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function resolveType(message) {
    const sender = message.sender_type || message.sender;
    if (sender === 'user' || sender === 'customer') return 'user';
    if (sender === 'admin' || message.is_admin) return 'support';
    return 'bot';
  }

  function ingestMessage(message) {
    if (!message?.id || displayedIds.has(Number(message.id))) return;
    const type = resolveType(message);
    displayedIds.add(Number(message.id));
    lastLiveMessageId = Math.max(lastLiveMessageId, Number(message.id));
    if (type === 'user') return;
    appendMessage(message.message_text, type);
  }

  async function loadHistory() {
    const data = await api.getLiveChatHistory();
    if (!data.found && !data.sessionId) return null;

    api.setSessionId(data.sessionId);
    updateStatus(data);

    (data.messages || []).forEach((message) => {
      const type = resolveType(message);
      if (type !== 'user') appendMessage(message.message_text, type);
      if (message.live_message_id) {
        displayedIds.add(Number(message.live_message_id));
        lastLiveMessageId = Math.max(lastLiveMessageId, Number(message.live_message_id));
      } else if (message.id) {
        displayedIds.add(Number(message.id));
        lastLiveMessageId = Math.max(lastLiveMessageId, Number(message.id));
      }
    });

    if (data.last_live_message_id) {
      lastLiveMessageId = Math.max(lastLiveMessageId, Number(data.last_live_message_id));
    }

    return data.sessionId;
  }

  async function startSession() {
    const data = await api.startLiveSession();
    api.setSessionId(data.sessionId);
    updateStatus(data);

    if (data.resumed && data.messages?.length) {
      data.messages.forEach((message) => {
        const type = resolveType(message);
        if (type !== 'user') appendMessage(message.message_text, type);
        if (message.live_message_id) displayedIds.add(Number(message.live_message_id));
      });
      if (data.last_live_message_id) {
        lastLiveMessageId = Math.max(lastLiveMessageId, Number(data.last_live_message_id));
      }
    } else if (data.reply) {
      appendMessage(data.reply, 'bot');
    }

    return data.sessionId;
  }

  function stopPolling() {
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = window.setInterval(pollLiveUpdates, 1500);
    pollLiveUpdates();
  }

  async function pollLiveUpdates() {
    if (!api.getSessionId()) return;
    try {
      const data = await api.getLiveUpdates(lastLiveMessageId);
      updateStatus({
        live_agent: data.live_agent,
        waiting_for_agent: data.status === 'WAITING_FOR_AGENT',
      });
      if (data.last_message_id) {
        lastLiveMessageId = Math.max(lastLiveMessageId, Number(data.last_message_id));
      }
      (data.messages || []).forEach(ingestMessage);
    } catch {
      // Ignore transient polling errors.
    }
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = inputEl?.value.trim();
    if (!text || !api.getSessionId() || sending) return;

    appendMessage(text, 'user');
    inputEl.value = '';
    sending = true;
    sendBtn.disabled = true;

    try {
      const data = await api.sendMessage(text, getCustomerUserId());
      if (data.reply) appendMessage(data.reply, 'bot');
      updateStatus(data);
      (data.new_messages || []).forEach(ingestMessage);
    } catch (err) {
      appendMessage(err.message || 'Send failed.', 'system');
    } finally {
      sending = false;
      sendBtn.disabled = false;
    }
  });

  return {
    async start() {
      renderUserBar();
      loadingEl?.classList.remove('hidden');
      panelEl?.classList.add('hidden');
      composeEl?.classList.add('hidden');

      try {
        let sessionId = null;
        if (isAuthenticated()) {
          try {
            sessionId = await loadHistory();
          } catch {
            sessionId = null;
          }
        }
        if (!sessionId) sessionId = await startSession();

        loadingEl?.classList.add('hidden');
        panelEl?.classList.remove('hidden');
        composeEl?.classList.remove('hidden');
        startPolling();
      } catch (err) {
        loadingEl?.classList.add('hidden');
        appendMessage(
          `${err.message}\n\nMake sure the API is running (npm start) and config has the correct URL.`,
          'system',
        );
        panelEl?.classList.remove('hidden');
      }
    },
    stop() {
      stopPolling();
    },
  };
}
