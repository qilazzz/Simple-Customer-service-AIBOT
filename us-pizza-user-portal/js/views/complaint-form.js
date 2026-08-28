import { COMPLAINT_CATEGORIES } from '../config.js';
import { getCustomerUser, isAuthenticated } from '../auth.js';
import { OutletsApi } from '../auth-api.js';
import { CustomerSupportApi } from '../api.js';

const DRAFT_KEY = 'us_pizza_complaint_draft_v1';
const MESSAGE_MAX = 750;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_MAX_COUNT = 3;

const SUPPORT_ILLUSTRATION = `
  <svg class="complaint-illustration-svg" viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="100" cy="128" rx="52" ry="8" fill="#e5e7eb"/>
    <circle cx="100" cy="58" r="28" fill="#fecaca"/>
    <path d="M72 58c0-15 12-28 28-28s28 13 28 28" fill="#c8102e"/>
    <rect x="62" y="52" width="18" height="22" rx="8" fill="#374151"/>
    <rect x="120" y="52" width="18" height="22" rx="8" fill="#374151"/>
    <path d="M78 52h44v8c0 8-6 14-14 14h-16c-8 0-14-6-14-14v-8z" fill="#1f2937"/>
    <circle cx="90" cy="60" r="3" fill="#fff"/>
    <circle cx="110" cy="60" r="3" fill="#fff"/>
    <path d="M94 70c2 2 10 2 12 0" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <rect x="84" y="86" width="32" height="36" rx="10" fill="#c8102e"/>
    <rect x="92" y="94" width="16" height="12" rx="4" fill="#fff" opacity="0.9"/>
    <path d="M136 78c12-4 22 4 22 16v10H136V78z" fill="#fff" stroke="#e5e7eb" stroke-width="2"/>
    <circle cx="148" cy="92" r="2" fill="#c8102e"/>
    <circle cx="154" cy="92" r="2" fill="#c8102e"/>
    <circle cx="160" cy="92" r="2" fill="#c8102e"/>
  </svg>
`;

function stripCountryCode(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('60') && digits.length > 9) return digits.slice(2);
  if (digits.startsWith('65') && digits.length > 8) return digits.slice(2);
  if (digits.startsWith('62') && digits.length > 9) return digits.slice(2);
  return digits;
}

function formatPhoneWithCountry(code, localDigits) {
  const digits = String(localDigits || '').replace(/\D/g, '');
  if (!digits) return '';
  const normalized = code.replace('+', '');
  return `+${normalized}${digits}`;
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(data) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

export function renderComplaintFormView(container, { guestMode = false, onSubmitted, onBack } = {}) {
  const outletsApi = new OutletsApi();
  const api = new CustomerSupportApi();
  const user = getCustomerUser();
  const signedIn = isAuthenticated() && !guestMode;
  const draft = loadDraft();

  let allOutlets = [];
  let selectedOutlet = draft?.selectedOutlet || null;
  let selectedCategory = draft?.selectedCategory || null;
  let outletModeOther = draft?.outletModeOther || false;
  const photos = [];

  container.innerHTML = `
    <main class="complaint-page">
      <div class="complaint-illustration-wrap">${SUPPORT_ILLUSTRATION}</div>

      <form id="complaint-form" class="complaint-steps" novalidate>
        <!-- Step 1 -->
        <section class="complaint-card" aria-labelledby="complaint-step1-title">
          <header class="complaint-card-header">
            <div>
              <h2 id="complaint-step1-title" class="complaint-card-title">Step 1: Your Information</h2>
              <p class="complaint-card-sub">Tell us about your order issue and our team will follow up.</p>
            </div>
            <span class="complaint-info-icon" title="Contact information" aria-hidden="true">ⓘ</span>
          </header>

          ${
            signedIn
              ? `<p class="complaint-signed-badge">Using your account: <strong>${user?.name || 'Member'}</strong></p>`
              : ''
          }

          <div class="complaint-field">
            <label class="complaint-field-label" for="complaint-name">Name</label>
            <div class="complaint-input-wrap">
              <span class="complaint-input-icon" aria-hidden="true">👤</span>
              <input id="complaint-name" type="text" autocomplete="name" placeholder="Name" maxlength="150" required
                value="${signedIn ? (user?.name || '') : (draft?.name || '')}" />
            </div>
          </div>

          <div class="complaint-field">
            <label class="complaint-field-label" for="complaint-phone">Phone No.</label>
            <div class="complaint-phone-row">
              <div class="complaint-country-select-wrap">
                <select id="complaint-country" class="complaint-country-select" aria-label="Country code">
                  <option value="+60" ${draft?.countryCode === '+60' || !draft?.countryCode ? 'selected' : ''}>+60 ▾</option>
                  <option value="+65" ${draft?.countryCode === '+65' ? 'selected' : ''}>+65 ▾</option>
                  <option value="+62" ${draft?.countryCode === '+62' ? 'selected' : ''}>+62 ▾</option>
                </select>
              </div>
              <div class="complaint-input-wrap complaint-input-wrap-flex">
                <span class="complaint-input-icon" aria-hidden="true">📞</span>
                <input id="complaint-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="123456789" maxlength="15" required
                  value="${signedIn && user?.phone_number ? stripCountryCode(user.phone_number) : (draft?.phone || '')}" />
              </div>
            </div>
          </div>

          <div class="complaint-field">
            <label class="complaint-field-label" for="complaint-email">Email</label>
            <div class="complaint-input-wrap">
              <span class="complaint-input-icon" aria-hidden="true">✉️</span>
              <input id="complaint-email" type="email" autocomplete="email" placeholder="Email" maxlength="150"
                value="${signedIn ? (user?.email || '') : (draft?.email || '')}" />
            </div>
          </div>
        </section>

        <div class="complaint-step-connector" aria-hidden="true">
          <div class="complaint-step-line"></div>
          <div class="complaint-step-node">↓</div>
          <div class="complaint-step-line"></div>
        </div>

        <!-- Step 2 -->
        <section class="complaint-card" aria-labelledby="complaint-step2-title">
          <header class="complaint-card-header">
            <h2 id="complaint-step2-title" class="complaint-card-title">Step 2: Order &amp; Issue Details</h2>
          </header>

          <div class="complaint-field">
            <label class="complaint-field-label" for="complaint-order-id">Order ID / Receipt No. <span class="req">*</span></label>
            <div class="complaint-input-wrap">
              <span class="complaint-input-icon" aria-hidden="true">🧾</span>
              <input id="complaint-order-id" type="text" placeholder="e.g. ORD-12345" maxlength="100" required value="${draft?.orderId || ''}" />
            </div>
          </div>

          <div class="complaint-field">
            <label class="complaint-field-label" for="complaint-state">Area/State <span class="req">*</span></label>
            <div class="complaint-input-wrap complaint-input-wrap-flag">
              <span class="complaint-input-icon" aria-hidden="true">📍</span>
              <input id="complaint-state" type="text" placeholder="e.g., Selangor" maxlength="80" required value="${draft?.state || ''}" />
              <span class="complaint-flag-badge" aria-hidden="true">🇲🇾</span>
            </div>
          </div>

          <div class="complaint-field">
            <span class="complaint-field-label">Outlet <span class="req">*</span></span>
            <div id="complaint-outlet-chips" class="complaint-chip-row" role="group" aria-label="Select outlet">
              <span class="complaint-chip-loading">Loading outlets…</span>
            </div>
            <div id="complaint-outlet-other-wrap" class="complaint-outlet-other hidden">
              <input id="complaint-outlet-other" type="text" placeholder="Enter outlet name" maxlength="150" value="${draft?.customOutlet || ''}" />
            </div>
          </div>

          <div class="complaint-field">
            <span class="complaint-field-label">Assistance type <span class="req">*</span></span>
            <div id="complaint-category-chips" class="complaint-chip-row" role="group" aria-label="Assistance type">
              ${COMPLAINT_CATEGORIES.map(
                (item) => `
                  <button type="button" class="complaint-chip" data-category="${item.value}">
                    <span class="complaint-chip-icon">${item.icon}</span>
                    <span>${item.label}</span>
                  </button>
                `,
              ).join('')}
            </div>
          </div>

          <div class="complaint-field">
            <label class="complaint-field-label" for="complaint-message">What went wrong?</label>
            <div class="complaint-textarea-wrap">
              <textarea id="complaint-message" rows="4" placeholder="Briefly describe your issue..." maxlength="${MESSAGE_MAX}" required>${draft?.message || ''}</textarea>
              <span class="complaint-textarea-fab" aria-hidden="true">✎</span>
              <span id="complaint-char-count" class="complaint-char-count">0/${MESSAGE_MAX}</span>
            </div>
          </div>
        </section>

        <!-- Step 3 -->
        <section class="complaint-card complaint-card-upload">
          <div class="complaint-upload-box">
            <label for="complaint-photo-input" class="complaint-upload-label">
              <span class="complaint-upload-icon" aria-hidden="true">📷</span>
              <span class="complaint-upload-title">Add Photos</span>
              <span class="complaint-upload-hint">Upload up to 3 photos as proof (max 5MB each)</span>
              <input id="complaint-photo-input" type="file" accept="image/*" multiple hidden />
            </label>
          </div>
          <div id="complaint-photo-preview" class="complaint-photo-preview"></div>

          <p id="complaint-error" class="form-error hidden" role="alert"></p>

          <button id="complaint-submit" type="submit" class="complaint-submit-btn">Submit Ticket</button>
          <button type="button" id="complaint-save-draft" class="complaint-draft-btn">Save Draft &amp; Exit</button>
        </section>
      </form>
    </main>
  `;

  const form = container.querySelector('#complaint-form');
  const outletChipsEl = container.querySelector('#complaint-outlet-chips');
  const outletOtherWrap = container.querySelector('#complaint-outlet-other-wrap');
  const outletOtherInput = container.querySelector('#complaint-outlet-other');
  const categoryChipsEl = container.querySelector('#complaint-category-chips');
  const stateInput = container.querySelector('#complaint-state');
  const messageInput = container.querySelector('#complaint-message');
  const charCountEl = container.querySelector('#complaint-char-count');
  const errorEl = container.querySelector('#complaint-error');
  const submitBtn = container.querySelector('#complaint-submit');
  const photoInput = container.querySelector('#complaint-photo-input');
  const photoPreview = container.querySelector('#complaint-photo-preview');

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  function updateCharCount() {
    const len = messageInput.value.length;
    charCountEl.textContent = `${len}/${MESSAGE_MAX}`;
  }

  function getFilteredOutlets() {
    const state = stateInput.value.trim().toLowerCase();
    if (!state) return allOutlets;
    return allOutlets.filter((outlet) => {
      const outletState = (outlet.state || '').toLowerCase();
      return outletState.includes(state) || state.includes(outletState);
    });
  }

  function renderOutletChips() {
    const filtered = getFilteredOutlets();
    const preview = filtered.slice(0, 3);

    if (!filtered.length) {
      outletChipsEl.innerHTML = `
        <button type="button" class="complaint-chip is-active" data-outlet="__other__">Other</button>
      `;
      outletModeOther = true;
      selectedOutlet = null;
      outletOtherWrap.classList.remove('hidden');
      bindOutletChips();
      return;
    }

    outletChipsEl.innerHTML = [
      ...preview.map(
        (outlet) => {
          const name = outlet.name || outlet.outlet_name || '';
          const short = name.length > 22 ? `${name.slice(0, 20)}…` : name;
          const active = selectedOutlet === name && !outletModeOther ? ' is-active' : '';
          return `<button type="button" class="complaint-chip${active}" data-outlet="${name.replace(/"/g, '&quot;')}" title="${name.replace(/"/g, '&quot;')}">${short}</button>`;
        },
      ),
      `<button type="button" class="complaint-chip${outletModeOther ? ' is-active' : ''}" data-outlet="__other__">Other</button>`,
    ].join('');

    outletOtherWrap.classList.toggle('hidden', !outletModeOther);
    bindOutletChips();
  }

  function bindOutletChips() {
    outletChipsEl.querySelectorAll('.complaint-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const value = chip.dataset.outlet;
        outletChipsEl.querySelectorAll('.complaint-chip').forEach((el) => el.classList.remove('is-active'));
        chip.classList.add('is-active');

        if (value === '__other__') {
          outletModeOther = true;
          selectedOutlet = null;
          outletOtherWrap.classList.remove('hidden');
          outletOtherInput.focus();
        } else {
          outletModeOther = false;
          selectedOutlet = value;
          outletOtherWrap.classList.add('hidden');
        }
      });
    });
  }

  function bindCategoryChips() {
    categoryChipsEl.querySelectorAll('.complaint-chip').forEach((chip) => {
      if (selectedCategory === chip.dataset.category) chip.classList.add('is-active');
      chip.addEventListener('click', () => {
        categoryChipsEl.querySelectorAll('.complaint-chip').forEach((el) => el.classList.remove('is-active'));
        chip.classList.add('is-active');
        selectedCategory = chip.dataset.category;
      });
    });
  }

  function renderPhotoPreview() {
    photoPreview.innerHTML = photos
      .map(
        (file, index) => `
          <div class="complaint-photo-thumb-wrap">
            <img src="${URL.createObjectURL(file)}" alt="Attachment ${index + 1}" class="complaint-photo-thumb" />
            <button type="button" class="complaint-photo-remove" data-index="${index}" aria-label="Remove photo">×</button>
          </div>
        `,
      )
      .join('');

    photoPreview.querySelectorAll('.complaint-photo-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        photos.splice(Number(btn.dataset.index), 1);
        renderPhotoPreview();
      });
    });
  }

  function collectDraftData() {
    return {
      name: container.querySelector('#complaint-name')?.value.trim(),
      phone: container.querySelector('#complaint-phone')?.value.trim(),
      email: container.querySelector('#complaint-email')?.value.trim(),
      countryCode: container.querySelector('#complaint-country')?.value,
      orderId: container.querySelector('#complaint-order-id')?.value.trim(),
      state: stateInput.value.trim(),
      message: messageInput.value.trim(),
      selectedOutlet,
      selectedCategory,
      outletModeOther,
      customOutlet: outletOtherInput.value.trim(),
    };
  }

  function applyDraftSelections() {
    if (selectedCategory) {
      categoryChipsEl.querySelector(`[data-category="${selectedCategory}"]`)?.classList.add('is-active');
    }
    if (outletModeOther) {
      outletOtherWrap.classList.remove('hidden');
    }
    updateCharCount();
  }

  function getOutletName() {
    if (outletModeOther) return outletOtherInput.value.trim();
    return selectedOutlet;
  }

  async function loadOutlets() {
    try {
      const data = await outletsApi.listOutlets();
      allOutlets = data.outlets || [];
      renderOutletChips();
      if (draft?.selectedOutlet && !outletModeOther) {
        selectedOutlet = draft.selectedOutlet;
        renderOutletChips();
      }
    } catch (err) {
      outletChipsEl.innerHTML = '<span class="complaint-chip-error">Could not load outlets</span>';
      showError(err.message || 'Could not load outlets.');
    }
  }

  photoInput?.addEventListener('change', () => {
    clearError();
    const picked = Array.from(photoInput.files || []);
    for (const file of picked) {
      if (file.size > PHOTO_MAX_BYTES) {
        showError(`${file.name} exceeds 5MB. Please choose a smaller photo.`);
        continue;
      }
      if (photos.length >= PHOTO_MAX_COUNT) break;
      photos.push(file);
    }
    photoInput.value = '';
    renderPhotoPreview();
  });

  messageInput?.addEventListener('input', updateCharCount);

  stateInput?.addEventListener('input', () => {
    selectedOutlet = null;
    outletModeOther = false;
    renderOutletChips();
  });

  container.querySelector('#complaint-save-draft')?.addEventListener('click', () => {
    saveDraft(collectDraftData());
    onBack?.();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const outletName = getOutletName();
    if (!selectedCategory) {
      showError('Please select an assistance type.');
      return;
    }
    if (!outletName) {
      showError('Please select or enter an outlet.');
      return;
    }

    const countryCode = container.querySelector('#complaint-country')?.value || '+60';
    const localPhone = container.querySelector('#complaint-phone')?.value.trim();

    const payload = {
      customer_name: container.querySelector('#complaint-name')?.value.trim(),
      customer_email: container.querySelector('#complaint-email')?.value.trim() || '',
      customer_phone: formatPhoneWithCountry(countryCode, localPhone),
      order_id: container.querySelector('#complaint-order-id')?.value.trim(),
      outlet_name: outletName,
      complaint_category: selectedCategory,
      message: messageInput.value.trim(),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      const data = await api.submitComplaintForm(payload, photos);
      clearDraft();
      onSubmitted?.(data.ticket_id);
    } catch (err) {
      showError(err.message || 'Could not submit complaint.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Ticket';
    }
  });

  bindCategoryChips();
  applyDraftSelections();
  loadOutlets();
}
