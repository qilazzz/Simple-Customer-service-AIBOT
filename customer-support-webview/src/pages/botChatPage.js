/**
 * Bot support page — mirrors mobile BotSupportChat entry flow.
 */

import { bootstrapCustomerAuth, getCustomerUserId } from '../auth/customerAuth.js';
import { CustomerSupportApi } from '../api/customerSupportApi.js';
import { initNativeBridge } from '../bridge/nativeBridge.js';

const params = new URLSearchParams(window.location.search);
const initialOption = params.get('option') || 'Support Chat';
const optionId = params.get('optionId') || 'other';

const titleEl = document.getElementById('bot-title');
const messagesEl = document.getElementById('bot-messages');
const composeForm = document.getElementById('bot-compose');
const inputEl = document.getElementById('bot-input');
const sendBtn = document.getElementById('bot-send-btn');
const loadingEl = document.getElementById('bot-loading');
const panelEl = document.getElementById('bot-chat-panel');
const errorEl = document.getElementById('bot-error');

const api = new CustomerSupportApi();

function showError(message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function appendBubble(text, role = 'bot') {
  if (!messagesEl || !text) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = text;
  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderBotReply(data) {
  const reply = data.reply || data.message || data.response;
  if (reply) appendBubble(reply, 'bot');
  (data.new_messages || []).forEach((message) => {
    if (message.message_text) {
      appendBubble(message.message_text, message.sender === 'user' ? 'user' : 'bot');
    }
  });
}

async function initBotChatPage() {
  initNativeBridge();
  await bootstrapCustomerAuth();

  if (titleEl) titleEl.textContent = initialOption;

  try {
    await api.startBotSession();
    loadingEl?.classList.add('hidden');
    panelEl?.classList.remove('hidden');

    const userId = getCustomerUserId();
    const data = await api.sendMessage(initialOption, userId);
    appendBubble(initialOption, 'user');
    renderBotReply(data);
  } catch (err) {
    loadingEl?.classList.add('hidden');
    showError(err.message || 'Could not start support chat.');
  }

  composeForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = inputEl?.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    try {
      const userId = getCustomerUserId();
      appendBubble(text, 'user');
      inputEl.value = '';
      const data = await api.sendMessage(text, userId);
      renderBotReply(data);
    } catch (err) {
      showError(err.message || 'Could not send message.');
    } finally {
      sendBtn.disabled = false;
      inputEl?.focus();
    }
  });
}

initBotChatPage();
