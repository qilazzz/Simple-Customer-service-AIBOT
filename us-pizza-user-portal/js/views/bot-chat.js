import { BOT_MENU } from '../config.js';
import { getCustomerUserId } from '../auth.js';
import { CustomerSupportApi } from '../api.js';
import { API_BASE_URL } from '../config.js';

function formatReply(text) {
  return String(text ?? '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\n---\n[\s\S]*$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createBotChatController(container, { onOpenOutlets, onTicketSubmitted } = {}) {
  const api = new CustomerSupportApi();

  let sessionId = null;
  let stage = 'menu';
  let flow = 'menu';
  let showMenu = true;
  let menuOptions = [...BOT_MENU];
  let outletOptions = [];
  let readyToSubmit = false;
  let photos = [];
  let sending = false;
  let submitting = false;

  container.innerHTML = `
    <div class="bot-chat-layout">
      <div id="bot-messages" class="chat-messages"></div>
      <div id="bot-loading" class="view-loading">Starting chat…</div>
      <div id="bot-menu-footer" class="menu-footer hidden"></div>
      <div id="bot-outlet-bar" class="outlet-bar hidden"></div>
      <div id="bot-photo-bar" class="photo-bar hidden">
        <label class="photo-add-btn">
          📎 Add photo
          <input id="bot-photo-input" type="file" accept="image/*" multiple hidden />
        </label>
        <div id="bot-photo-preview" class="photo-preview"></div>
      </div>
      <footer class="chat-compose">
        <form id="bot-form" class="send-form send-form-stack">
          <input id="bot-input" type="text" placeholder="Type your message..." autocomplete="off" maxlength="2000" />
          <div class="compose-actions">
            <button id="bot-send-btn" type="submit">Send</button>
            <button id="bot-submit-btn" type="button" class="btn-submit hidden">Submit</button>
          </div>
        </form>
      </footer>
    </div>
  `;

  const messagesEl = container.querySelector('#bot-messages');
  const loadingEl = container.querySelector('#bot-loading');
  const menuFooterEl = container.querySelector('#bot-menu-footer');
  const outletBarEl = container.querySelector('#bot-outlet-bar');
  const photoBarEl = container.querySelector('#bot-photo-bar');
  const photoInput = container.querySelector('#bot-photo-input');
  const photoPreview = container.querySelector('#bot-photo-preview');
  const form = container.querySelector('#bot-form');
  const inputEl = container.querySelector('#bot-input');
  const sendBtn = container.querySelector('#bot-send-btn');
  const submitBtn = container.querySelector('#bot-submit-btn');

  function append(text, role) {
    if (!text?.trim()) return;
    const div = document.createElement('div');
    div.className = `msg ${role === 'ai' ? 'bot' : role}`;
    div.textContent = formatReply(text);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderMenuFooter() {
    if (!showMenu || !messagesEl.childElementCount) {
      menuFooterEl.classList.add('hidden');
      return;
    }

    menuFooterEl.classList.remove('hidden');
    menuFooterEl.innerHTML = `
      <p class="menu-footer-title">Quick options</p>
      <div class="menu-chips">
        ${menuOptions
          .map(
            (item) => `
              <button type="button" class="menu-chip" data-chip-id="${item.id}">
                ${item.emoji} ${item.label}
              </button>
            `,
          )
          .join('')}
      </div>
    `;

    menuFooterEl.querySelectorAll('.menu-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const item = menuOptions.find((entry) => entry.id === chip.dataset.chipId);
        if (!item) return;
        if (item.id === 'find_outlet') {
          onOpenOutlets?.();
          return;
        }
        dispatchMessage(item.label);
      });
    });
  }

  function renderOutletBar() {
    const inComplaint = flow === 'complaint';
    if (stage !== 'outlet' || !inComplaint || !outletOptions.length) {
      outletBarEl.classList.add('hidden');
      return;
    }

    outletBarEl.classList.remove('hidden');
    outletBarEl.innerHTML = `
      <p class="outlet-title">Select an outlet:</p>
      <input id="bot-outlet-search" type="search" placeholder="Search outlets..." class="outlet-search" />
      <div id="bot-outlet-list" class="outlet-list"></div>
    `;

    const searchEl = outletBarEl.querySelector('#bot-outlet-search');
    const listEl = outletBarEl.querySelector('#bot-outlet-list');

    function paintOutlets(term = '') {
      const hay = term.trim().toLowerCase();
      const filtered = outletOptions.filter((outlet) => {
        if (!hay) return true;
        const name = (outlet.label || outlet.name || '').toLowerCase();
        const state = (outlet.state || '').toLowerCase();
        const city = (outlet.city || '').toLowerCase();
        return name.includes(hay) || state.includes(hay) || city.includes(hay);
      });

      listEl.innerHTML = filtered
        .slice(0, 60)
        .map((outlet) => {
          const name = outlet.label || outlet.name || '';
          const meta = [outlet.city, outlet.state].filter(Boolean).join(', ');
          return `
            <button type="button" class="outlet-option" data-outlet-name="${name.replace(/"/g, '&quot;')}">
              <span class="outlet-option-name">${name}</span>
              ${meta ? `<span class="outlet-option-meta">${meta}</span>` : ''}
            </button>
          `;
        })
        .join('');

      listEl.querySelectorAll('.outlet-option').forEach((btn) => {
        btn.addEventListener('click', () => dispatchMessage(btn.dataset.outletName));
      });
    }

    searchEl.addEventListener('input', () => paintOutlets(searchEl.value));
    paintOutlets();
  }

  function renderPhotoBar() {
    const inComplaint = flow === 'complaint';
    const showPhoto = stage === 'photo' || stage === 'ready';
    photoBarEl.classList.toggle('hidden', !(inComplaint && showPhoto));

    photoPreview.innerHTML = photos
      .map(
        (file, index) => `
          <div class="photo-thumb-wrap">
            <img src="${URL.createObjectURL(file)}" alt="Attachment ${index + 1}" class="photo-thumb" />
          </div>
        `,
      )
      .join('');
  }

  function applyResponse(data, userLabel) {
    if (userLabel) append(userLabel, 'user');
    if (data.reply) append(data.reply, 'ai');
    stage = data.stage || stage;
    flow = data.flow || flow;
    showMenu = Boolean(data.show_menu);
    if (data.menu_options?.length) {
      menuOptions = data.menu_options.filter((item) => item.id !== 'other');
    }
    if (data.outlet_options?.length) outletOptions = data.outlet_options;
    readyToSubmit = Boolean(data.ready_to_submit);

    submitBtn.classList.toggle('hidden', !readyToSubmit || flow !== 'complaint');
    submitBtn.disabled = submitting;

    renderMenuFooter();
    renderOutletBar();
    renderPhotoBar();
  }

  async function dispatchMessage(text, { showUserBubble = true } = {}) {
    if (!text?.trim() || !sessionId || sending) return null;
    if (showUserBubble) append(text, 'user');
    sending = true;
    sendBtn.disabled = true;

    try {
      const data = await api.sendMessage(text, getCustomerUserId());
      applyResponse(data, showUserBubble ? null : text);
      return data;
    } catch (err) {
      append(err.message || 'Send failed.', 'system');
      return null;
    } finally {
      sending = false;
      sendBtn.disabled = false;
    }
  }

  async function submitComplaint() {
    if (!sessionId || !readyToSubmit || submitting) return;
    submitting = true;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    try {
      const data = await api.submitComplaint(photos, getCustomerUserId());
      append(data.reply, 'ai');
      readyToSubmit = false;
      photos = [];
      submitBtn.classList.add('hidden');
      submitBtn.textContent = 'Submit';
      renderPhotoBar();
      if (data.ticket_id) onTicketSubmitted?.(data.ticket_id);
    } catch (err) {
      append(err.message || 'Submit failed.', 'system');
    } finally {
      submitting = false;
      submitBtn.disabled = false;
      if (readyToSubmit) submitBtn.textContent = 'Submit';
    }
  }

  photoInput?.addEventListener('change', () => {
    photos = [...photos, ...Array.from(photoInput.files || [])].slice(0, 3);
    photoInput.value = '';
    renderPhotoBar();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    await dispatchMessage(text);
  });

  submitBtn?.addEventListener('click', submitComplaint);

  return {
    async start(initialOption = null) {
      loadingEl.classList.remove('hidden');
      try {
        const data = await api.startBotSession();
        sessionId = data.sessionId;
        stage = data.stage || 'menu';
        flow = data.flow || 'menu';
        showMenu = data.show_menu !== false;
        if (data.menu_options?.length) {
          menuOptions = data.menu_options.filter((item) => item.id !== 'other');
        }
        if (data.reply) append(data.reply, 'ai');
        renderMenuFooter();
        if (initialOption) await dispatchMessage(initialOption, { showUserBubble: true });
      } catch (err) {
        append(
          `${err.message}\n\nMake sure the API is running and apiBase points to ${API_BASE_URL}.`,
          'system',
        );
      } finally {
        loadingEl.classList.add('hidden');
      }
    },
    destroy() {
      photos.forEach((_, i) => {});
    },
  };
}
