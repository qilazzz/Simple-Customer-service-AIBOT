import { COMPLAINT_CATEGORIES } from '../config.js';
import { getCustomerUser, isAuthenticated } from '../auth.js';
import { OutletsApi } from '../auth-api.js';
import { CustomerSupportApi } from '../api.js';

function stripCountryCode(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('60') && digits.length > 9) return digits.slice(2);
  return digits;
}

function formatPhoneWithCountry(localDigits) {
  const digits = String(localDigits || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('60') ? `+${digits}` : `+60${digits}`;
}

export function renderComplaintFormView(container, { guestMode = false, onSubmitted, onBack } = {}) {
  const outletsApi = new OutletsApi();
  const api = new CustomerSupportApi();
  const user = getCustomerUser();
  const signedIn = isAuthenticated() && !guestMode;
  const needsPhoneField = !signedIn || !user?.phone_number;
  const photos = [];
  const orderSection = signedIn ? (needsPhoneField ? 2 : 1) : 2;
  const assistSection = orderSection + 1;
  const messageSection = assistSection + 1;
  const photoSection = messageSection + 1;

  container.innerHTML = `
    <main class="scroll-content complaint-scroll">
      <section class="complaint-hero">
        <span class="complaint-hero-icon" aria-hidden="true">📋</span>
        <h2 class="complaint-hero-title">How May I Assist You?</h2>
        <p class="complaint-hero-sub">Tell us about your order issue and our team will follow up.</p>
      </section>

      ${
        signedIn
          ? `
            <section class="complaint-account-card">
              <p class="complaint-account-label">Submitting as</p>
              <p class="complaint-account-name">${user?.name || 'US Pizza member'}</p>
              <p class="complaint-account-meta">${[user?.email, user?.phone_number].filter(Boolean).join(' · ')}</p>
            </section>
            ${
              needsPhoneField
                ? `
                  <section class="complaint-section">
                    <h3 class="complaint-section-title">Contact phone</h3>
                    <label class="field">
                      <span class="field-label">Phone No. <span class="req">*</span></span>
                      <div class="phone-input-row">
                        <span class="phone-prefix">+60</span>
                        <input id="complaint-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="123456789" maxlength="15" required />
                      </div>
                    </label>
                  </section>
                `
                : ''
            }
          `
          : `
              <section class="complaint-section">
                <h3 class="complaint-section-title">1. Contact details</h3>
                <label class="field">
                  <span class="field-label">Name <span class="req">*</span></span>
                  <input id="complaint-name" type="text" autocomplete="name" placeholder="Name" maxlength="150" required />
                </label>
                <label class="field">
                  <span class="field-label">Phone No. <span class="req">*</span></span>
                  <div class="phone-input-row">
                    <span class="phone-prefix">+60</span>
                    <input id="complaint-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="123456789" maxlength="15" required />
                  </div>
                </label>
                <label class="field">
                  <span class="field-label">Email</span>
                  <input id="complaint-email" type="email" autocomplete="email" placeholder="Email" maxlength="150" />
                </label>
              </section>
            `
      }

      <form id="complaint-form" class="complaint-form">
        <section class="complaint-section">
          <h3 class="complaint-section-title">${orderSection}. Order details</h3>
          <label class="field">
            <span class="field-label">Order ID / Receipt No. <span class="req">*</span></span>
            <input id="complaint-order-id" type="text" placeholder="e.g. ORD-12345" maxlength="100" required />
          </label>
          <label class="field">
            <span class="field-label">Outlet <span class="req">*</span></span>
            <select id="complaint-outlet" required disabled>
              <option value="">Loading outlets…</option>
            </select>
          </label>
        </section>

        <section class="complaint-section">
          <h3 class="complaint-section-title">${assistSection}. Assistance type <span class="req">*</span></h3>
          <label class="field">
            <select id="complaint-category" required>
              <option value="">Select assistance type</option>
              ${COMPLAINT_CATEGORIES.map(
                (item) => `<option value="${item.value}">${item.label}</option>`,
              ).join('')}
            </select>
          </label>
        </section>

        <section class="complaint-section">
          <h3 class="complaint-section-title">${messageSection}. What went wrong? <span class="req">*</span></h3>
          <label class="field">
            <textarea id="complaint-message" rows="4" placeholder="Briefly describe your issue..." maxlength="2000" required></textarea>
          </label>
        </section>

        <section class="complaint-section">
          <h3 class="complaint-section-title">${photoSection}. Photo <span class="optional">(optional)</span></h3>
          <div class="complaint-photo-area">
            <label class="complaint-photo-btn">
              📎 Add photo
              <input id="complaint-photo-input" type="file" accept="image/*" multiple hidden />
            </label>
            <p class="complaint-photo-hint">Upload up to 3 photos as proof (optional).</p>
            <div id="complaint-photo-preview" class="complaint-photo-preview"></div>
          </div>
        </section>

        <p id="complaint-error" class="form-error hidden" role="alert"></p>

        <button id="complaint-submit" type="submit" class="btn-primary-block">Submit Complaint</button>
        <button type="button" id="complaint-cancel" class="btn-text-block">Cancel</button>
      </form>
    </main>
  `;

  const form = container.querySelector('#complaint-form');
  const outletSelect = container.querySelector('#complaint-outlet');
  const errorEl = container.querySelector('#complaint-error');
  const submitBtn = container.querySelector('#complaint-submit');
  const photoInput = container.querySelector('#complaint-photo-input');
  const photoPreview = container.querySelector('#complaint-photo-preview');

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
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

  async function loadOutlets() {
    try {
      const data = await outletsApi.listOutlets();
      const outlets = data.outlets || [];
      if (!outlets.length) {
        outletSelect.innerHTML = '<option value="">No outlets available — type in description</option>';
        outletSelect.disabled = false;
        outletSelect.removeAttribute('required');
        return;
      }

      outletSelect.innerHTML = [
        '<option value="">Select an outlet</option>',
        ...outlets.map(
          (outlet) =>
            `<option value="${(outlet.name || outlet.outlet_name || '').replace(/"/g, '&quot;')}">${outlet.name || outlet.outlet_name}${outlet.city ? ` — ${outlet.city}` : ''}</option>`,
        ),
      ].join('');
      outletSelect.disabled = false;
    } catch (err) {
      outletSelect.innerHTML = '<option value="">Could not load outlets</option>';
      outletSelect.disabled = false;
      showError(err.message || 'Could not load outlets.');
    }
  }

  photoInput?.addEventListener('change', () => {
    const picked = Array.from(photoInput.files || []);
    photos.splice(0, photos.length, ...[...photos, ...picked].slice(0, 3));
    photoInput.value = '';
    renderPhotoPreview();
  });

  container.querySelector('#complaint-cancel')?.addEventListener('click', () => onBack?.());

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const payload = {
      complaint_category: container.querySelector('#complaint-category')?.value || 'other',
      order_id: container.querySelector('#complaint-order-id')?.value.trim(),
      outlet_name: container.querySelector('#complaint-outlet')?.value.trim() || null,
      message: container.querySelector('#complaint-message')?.value.trim(),
    };

    if (signedIn) {
      payload.customer_name = user?.name?.trim();
      payload.customer_email = user?.email?.trim() || '';
      if (needsPhoneField) {
        const localPhone = container.querySelector('#complaint-phone')?.value.trim();
        payload.customer_phone = formatPhoneWithCountry(localPhone);
      } else {
        payload.customer_phone = formatPhoneWithCountry(stripCountryCode(user?.phone_number || ''));
      }
    } else {
      payload.customer_name = container.querySelector('#complaint-name')?.value.trim();
      payload.customer_email = container.querySelector('#complaint-email')?.value.trim() || '';
      const localPhone = container.querySelector('#complaint-phone')?.value.trim();
      payload.customer_phone = formatPhoneWithCountry(localPhone);
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      const data = await api.submitComplaintForm(payload, photos);
      onSubmitted?.(data.ticket_id);
    } catch (err) {
      showError(err.message || 'Could not submit complaint.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Complaint';
    }
  });

  loadOutlets();
}
