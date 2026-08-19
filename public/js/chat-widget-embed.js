/**
 * Chat UI for embed.html and in-app WebView — uses CustomerSupportClient SDK.
 */
const messagesEl = document.getElementById('chat-messages');
const inputEl = document.getElementById('message-input') || document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const submitBtn = document.getElementById('submit-btn');
const fileInput = document.getElementById('chat-files');
const typingEl = document.getElementById('typing');
const photoHintEl = document.getElementById('photo-hint');

const params = new URLSearchParams(window.location.search);
const apiBase = params.get('apiBase') || window.location.origin;

const client = new CustomerSupportClient({ baseUrl: apiBase });

function appendMessage(text, type = 'ai') {
  const div = document.createElement('div');
  div.className = `msg ${type}`;
  div.textContent = text.replace(/\*\*(.*?)\*\*/g, '$1');
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setTyping(visible) {
  typingEl.classList.toggle('hidden', !visible);
}

function updatePhotoHint(stage) {
  if (!photoHintEl) return;
  photoHintEl.classList.toggle('hidden', stage !== 'photo' && stage !== 'ready');
  if (stage === 'photo' || stage === 'ready') {
    fileInput.closest('.photo-upload-bar')?.classList.remove('hidden');
  }
}

async function startSession() {
  const data = await client.startSession();
  appendMessage(data.reply, 'ai');
  updatePhotoHint(data.stage);
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  appendMessage(text, 'user');
  inputEl.value = '';
  sendBtn.disabled = true;
  setTyping(true);

  try {
    const data = await client.sendMessage(text);
    appendMessage(data.reply, 'ai');
    updatePhotoHint(data.stage);
    submitBtn.disabled = !data.readyToSubmit;
  } catch (err) {
    appendMessage(err.message || 'Something went wrong.', 'system');
  } finally {
    sendBtn.disabled = false;
    setTyping(false);
  }
}

async function submitComplaint() {
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  const photos = Array.from(fileInput.files || []);

  try {
    const data = await client.submitComplaint(photos);
    appendMessage(data.reply, 'ai');
    inputEl.disabled = true;
    sendBtn.disabled = true;
    fileInput.disabled = true;
    submitBtn.textContent = 'Ticket Logged ✓';
  } catch (err) {
    appendMessage(err.message || 'Submit failed.', 'system');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit';
  }
}

sendBtn.addEventListener('click', sendMessage);
submitBtn.addEventListener('click', submitComplaint);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

setupMobileKeyboardFix({ inputEl, messagesEl });

startSession().catch((err) => appendMessage(err.message, 'system'));
