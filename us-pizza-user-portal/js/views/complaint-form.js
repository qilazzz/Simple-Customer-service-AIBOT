import { COMPLAINT_CATEGORIES } from '../config.js';
import { getCustomerUser, isAuthenticated } from '../auth.js';
import { OutletsApi } from '../auth-api.js';
import { CustomerSupportApi } from '../api.js';

const DRAFT_KEY = 'us_pizza_complaint_draft_v1';
const MESSAGE_MAX = 750;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_MAX_COUNT = 3;

const FALLBACK_STATES = [
  'Selangor',
  'Penang',
  'Johor',
  'Kuala Lumpur',
  'Kedah',
  'Perak',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Kelantan',
  'Terengganu',
  'Sabah',
  'Sarawak',
  'Labuan',
];

const OUTLET_OTHER_VALUE = '__other__';

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
  let availableStates = [...FALLBACK_STATES];
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
            <label class="complaint-field-label" for="stateSelect">Area/State <span class="req">*</span></label>
            <select id="stateSelect" class="complaint-select" required>
              <option value="">Select state</option>
            </select>
          </div>

          <div class="complaint-field">
            <label class="complaint-field-label" for="outletSelect">Outlet <span class="req">*</span></label>
            <select id="outletSelect" class="complaint-select" disabled required>
              <option value="">Select state first</option>
            </select>
            <div id="complaint-outlet-other-wrap" class="complaint-outlet-other hidden">
              <input id="complaint-outlet-other" type="text" class="complaint-select" placeholder="Enter outlet name" maxlength="150" value="${draft?.customOutlet || ''}" />
            </div>
          </div>

          <div class="complaint-field">
            <label class="complaint-field-label" for="assistanceType">Assistance type <span class="req">*</span></label>
            <select id="assistanceType" class="complaint-select" required>
              <option value="" disabled ${draft?.selectedCategory ? '' : 'selected'}>Select assistance type</option>
              ${COMPLAINT_CATEGORIES.map(
                (item) =>
                  `<option value="${item.value}"${draft?.selectedCategory === item.value ? ' selected' : ''}>${item.label}</option>`,
              ).join('')}
            </select>
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
  const stateSelect = container.querySelector('#stateSelect');
  const outletSelect = container.querySelector('#outletSelect');
  const outletOtherWrap = container.querySelector('#complaint-outlet-other-wrap');
  const outletOtherInput = container.querySelector('#complaint-outlet-other');
  const assistanceTypeSelect = container.querySelector('#assistanceType');
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

  function normalizeState(value) {
    return String(value || '').trim().toLowerCase();
  }

  function mergeStates(dbStates = []) {
    const merged = new Set([...FALLBACK_STATES, ...dbStates.filter(Boolean)]);
    return [...merged].sort((a, b) => a.localeCompare(b));
  }

  function populateStateSelect() {
    stateSelect.innerHTML = [
      '<option value="">Select state</option>',
      ...availableStates.map(
        (state) => `<option value="${state.replace(/"/g, '&quot;')}">${state}</option>`,
      ),
    ].join('');
  }

  function getOutletsForState(state) {
    const target = normalizeState(state);
    if (!target) return [];
    return allOutlets.filter((outlet) => normalizeState(outlet.state) === target);
  }

  function toggleOutletOtherField(show) {
    outletOtherWrap.classList.toggle('hidden', !show);
    if (!show) outletOtherInput.value = '';
  }

  function populateOutletSelect(state, preferredValue = '') {
    if (!state) {
      outletSelect.disabled = true;
      outletSelect.innerHTML = '<option value="">Select state first</option>';
      toggleOutletOtherField(false);
      return;
    }

    const filtered = getOutletsForState(state);
    outletSelect.disabled = false;
    outletSelect.innerHTML = [
      '<option value="">Select outlet</option>',
      ...filtered.map((outlet) => {
        const name = outlet.name || outlet.outlet_name || '';
        return `<option value="${name.replace(/"/g, '&quot;')}">${name}</option>`;
      }),
      `<option value="${OUTLET_OTHER_VALUE}">Other</option>`,
    ].join('');

    if (preferredValue) {
      outletSelect.value = preferredValue;
      toggleOutletOtherField(preferredValue === OUTLET_OTHER_VALUE);
    } else {
      outletSelect.value = '';
      toggleOutletOtherField(false);
    }
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
      state: stateSelect.value.trim(),
      message: messageInput.value.trim(),
      selectedOutlet: outletSelect.value === OUTLET_OTHER_VALUE ? '' : outletSelect.value,
      selectedCategory: assistanceTypeSelect?.value || '',
      outletModeOther: outletSelect.value === OUTLET_OTHER_VALUE,
      customOutlet: outletOtherInput.value.trim(),
    };
  }

  function applyDraftSelections() {
    if (draft?.state) {
      stateSelect.value = draft.state;
      const preferredOutlet = draft.outletModeOther ? OUTLET_OTHER_VALUE : draft.selectedOutlet || '';
      populateOutletSelect(draft.state, preferredOutlet);
    }
    if (draft?.selectedCategory && assistanceTypeSelect) {
      assistanceTypeSelect.value = draft.selectedCategory;
    }
    updateCharCount();
  }

  function getOutletName() {
    if (outletSelect.value === OUTLET_OTHER_VALUE) return outletOtherInput.value.trim();
    return outletSelect.value.trim();
  }

  async function loadOutlets() {
    try {
      const [outletsData, statesData] = await Promise.all([
        outletsApi.listOutlets(),
        outletsApi.listStates().catch(() => ({ states: [] })),
      ]);
      allOutlets = outletsData.outlets || [];
      availableStates = mergeStates(statesData.states || []);
      populateStateSelect();
      applyDraftSelections();
    } catch (err) {
      availableStates = mergeStates([]);
      populateStateSelect();
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

  stateSelect?.addEventListener('change', () => {
    populateOutletSelect(stateSelect.value);
  });

  outletSelect?.addEventListener('change', () => {
    toggleOutletOtherField(outletSelect.value === OUTLET_OTHER_VALUE);
    if (outletSelect.value === OUTLET_OTHER_VALUE) outletOtherInput.focus();
  });

  container.querySelector('#complaint-save-draft')?.addEventListener('click', () => {
    saveDraft(collectDraftData());
    onBack?.();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const outletName = getOutletName();
    const assistanceType = assistanceTypeSelect?.value?.trim();
    if (!assistanceType) {
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
      complaint_category: assistanceType,
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

  loadOutlets();
}
