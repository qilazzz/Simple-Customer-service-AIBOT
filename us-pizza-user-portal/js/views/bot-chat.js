import { BOT_MENU } from '../config.js';
import { getCustomerUserId, isAuthenticated } from '../auth.js';
import { CustomerSupportApi } from '../api.js';
import { OutletsApi } from '../auth-api.js';
import { API_BASE_URL } from '../config.js';
import { trackMenuButtonClick } from '../analytics.js';

function formatReply(text) {
  return String(text ?? '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\n---\n[\s\S]*$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createBotChatController(container, { guestMode = false, onOpenOutlets, onTicketSubmitted } = {}) {
  const api = new CustomerSupportApi();
  const outletsApi = new OutletsApi();
  const isGuest = guestMode || !isAuthenticated();

  let sessionId = null;
  let stage = 'menu';
  let flow = 'menu';
  let showMenu = true;
  let menuOptions = [...BOT_MENU];
  let outletOptions = [];
  let needsGuestContact = false;
  let savingGuestDetails = false;
  let readyToSubmit = false;
  let photos = [];
  let sending = false;
  let submitting = false;

  container.innerHTML = `
    <div class="bot-chat-layout">
      <div id="bot-messages" class="chat-messages"></div>
      <div id="bot-loading" class="view-loading">Starting chat…</div>
      <div id="bot-menu-footer" class="menu-footer hidden"></div>
      <div id="bot-guest-bar" class="guest-contact-bar hidden"></div>
      <div id="bot-outlet-bar" class="outlet-bar hidden"></div>
      <div id="bot-order-id-bar" class="order-id-bar hidden"></div>
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
  const guestBarEl = container.querySelector('#bot-guest-bar');
  const outletBarEl = container.querySelector('#bot-outlet-bar');
  const orderIdBarEl = container.querySelector('#bot-order-id-bar');
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
          trackMenuButtonClick(item.label);
          onOpenOutlets?.();
          return;
        }
        trackMenuButtonClick(item.label);
        dispatchMessage(item.label);
      });
    });
  }

  async function ensureOutletOptions() {
    if (outletOptions.length) return outletOptions;
    try {
      const data = await outletsApi.listOutlets();
      outletOptions = (data.outlets || []).map((outlet) => ({
        id: outlet.id || outlet.outlet_id,
        outlet_id: outlet.outlet_id || outlet.id,
        label: outlet.name || outlet.outlet_name,
        name: outlet.name || outlet.outlet_name,
        state: outlet.state || null,
        city: outlet.city || null,
      }));
    } catch {
      // Keep empty — user can still type outlet name.
    }
    return outletOptions;
  }

  function renderGuestBar() {
    const showGuestForm =
      isGuest && needsGuestContact && flow === 'complaint' && stage === 'contact';

    if (!showGuestForm) {
      guestBarEl.classList.add('hidden');
      return;
    }

    guestBarEl.classList.remove('hidden');
    guestBarEl.innerHTML = `
      <p class="guest-contact-title">Your contact details</p>
      <p class="guest-contact-desc">We need this so our team can follow up on your complaint.</p>
      <form id="bot-guest-form" class="guest-contact-form">
        <label class="guest-field">
          <span>Full name</span>
          <input id="bot-guest-name" type="text" autocomplete="name" maxlength="120" required />
        </label>
        <label class="guest-field">
          <span>Email</span>
          <input id="bot-guest-email" type="email" autocomplete="email" maxlength="200" required />
        </label>
        <label class="guest-field">
          <span>Phone number</span>
          <input id="bot-guest-phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" required />
        </label>
        <p id="bot-guest-error" class="guest-contact-error hidden"></p>
        <button id="bot-guest-submit" type="submit" class="btn-primary guest-contact-submit">Continue</button>
      </form>
    `;

    const guestForm = guestBarEl.querySelector('#bot-guest-form');
    const guestErrorEl = guestBarEl.querySelector('#bot-guest-error');
    const guestSubmitBtn = guestBarEl.querySelector('#bot-guest-submit');

    guestForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!sessionId || savingGuestDetails) return;

      const name = guestBarEl.querySelector('#bot-guest-name')?.value.trim();
      const email = guestBarEl.querySelector('#bot-guest-email')?.value.trim();
      const phone = guestBarEl.querySelector('#bot-guest-phone')?.value.trim();

      savingGuestDetails = true;
      guestSubmitBtn.disabled = true;
      guestSubmitBtn.textContent = 'Saving…';
      guestErrorEl.classList.add('hidden');

      try {
        const data = await api.submitGuestDetails({ name, email, phone });
        append('Contact details submitted', 'user');
        applyResponse(data);
      } catch (err) {
        guestErrorEl.textContent = err.message || 'Could not save your details.';
        guestErrorEl.classList.remove('hidden');
      } finally {
        savingGuestDetails = false;
        guestSubmitBtn.disabled = false;
        guestSubmitBtn.textContent = 'Continue';
      }
    });
  }

  async function renderOutletBar() {
    const inComplaint = flow === 'complaint';
    if (stage !== 'outlet' || !inComplaint) {
      outletBarEl.classList.add('hidden');
      return;
    }

    await ensureOutletOptions();

    outletBarEl.classList.remove('hidden');

    if (!outletOptions.length) {
      outletBarEl.innerHTML = `
        <p class="outlet-title">No outlets loaded yet</p>
        <p class="outlet-empty-note">Type the outlet name in the chat, or browse all locations.</p>
        <button type="button" id="bot-open-outlets" class="btn-outline outlet-browse-btn">Find Outlets</button>
      `;
      outletBarEl.querySelector('#bot-open-outlets')?.addEventListener('click', () => onOpenOutlets?.());
      return;
    }

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

  function renderOrderIdBar() {
    const showOrderId = flow === 'complaint' && stage === 'order_id';

    if (!showOrderId) {
      orderIdBarEl.classList.add('hidden');
      return;
    }

    orderIdBarEl.classList.remove('hidden');
    orderIdBarEl.innerHTML = `
      <p class="order-id-title">Order ID / Receipt number</p>
      <p class="order-id-desc">Find this on your receipt, app order history, or delivery confirmation.</p>
      <form id="bot-order-id-form" class="order-id-form">
        <input id="bot-order-id-input" type="text" placeholder="e.g. ORD-12345 or receipt number" autocomplete="off" maxlength="100" required />
        <button id="bot-order-id-submit" type="submit" class="btn-primary order-id-submit">Continue</button>
      </form>
    `;

    const orderForm = orderIdBarEl.querySelector('#bot-order-id-form');
    const orderInput = orderIdBarEl.querySelector('#bot-order-id-input');
    const orderSubmitBtn = orderIdBarEl.querySelector('#bot-order-id-submit');

    orderForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const orderId = orderInput?.value.trim();
      if (!orderId || sending) return;
      orderSubmitBtn.disabled = true;
      await dispatchMessage(orderId);
      orderSubmitBtn.disabled = false;
    });
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

  async function applyResponse(data, userLabel) {
    if (userLabel) append(userLabel, 'user');
    if (data.reply) append(data.reply, 'ai');
    stage = data.stage || stage;
    flow = data.flow || flow;
    showMenu = Boolean(data.show_menu);
    if (data.menu_options?.length) {
      menuOptions = data.menu_options.filter((item) => item.id !== 'other');
    }
    if (data.outlet_options?.length) {
      outletOptions = data.outlet_options;
    }
    needsGuestContact = Boolean(data.needs_guest_contact);
    readyToSubmit = Boolean(data.ready_to_submit);

    submitBtn.classList.toggle('hidden', !readyToSubmit || flow !== 'complaint');
    submitBtn.disabled = submitting;

    renderMenuFooter();
    renderGuestBar();
    await renderOutletBar();
    renderOrderIdBar();
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
        if (initialOption) {
          trackMenuButtonClick(initialOption);
          await dispatchMessage(initialOption, { showUserBubble: true });
        }
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
