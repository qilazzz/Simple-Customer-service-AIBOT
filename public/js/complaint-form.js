const form = document.getElementById('complaint-form');
const successBanner = document.getElementById('success-banner');
const errorBanner = document.getElementById('error-banner');
const ticketIdEl = document.getElementById('ticket-id');
const submitBtn = document.getElementById('submit-btn');
const photoInput = document.getElementById('photos');
const photoPreviewGrid = document.getElementById('photo-preview-grid');

const fieldErrors = {
  customer_name: document.getElementById('error-customer_name'),
  customer_email: document.getElementById('error-customer_email'),
  message: document.getElementById('error-message'),
};

function hideBanners() {
  successBanner.classList.remove('visible');
  errorBanner.classList.remove('visible');
}

function showSuccess(ticketId, photosUploaded) {
  hideBanners();
  ticketIdEl.textContent = `#${ticketId}`;
  const photoNote = document.getElementById('success-photo-note');
  if (photoNote) {
    photoNote.textContent =
      photosUploaded > 0
        ? `${photosUploaded} photo(s) uploaded with your complaint.`
        : 'No photos were attached.';
  }
  successBanner.classList.add('visible');
  successBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(message) {
  hideBanners();
  errorBanner.textContent = message;
  errorBanner.classList.add('visible');
  errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearFieldErrors() {
  Object.values(fieldErrors).forEach((el) => el.classList.remove('visible'));
}

function showFieldError(field, message) {
  const el = fieldErrors[field];
  if (el) {
    el.textContent = message;
    el.classList.add('visible');
  }
}

function validateClientSide(data) {
  clearFieldErrors();
  let valid = true;

  if (!data.customer_name) {
    showFieldError('customer_name', 'Name is required.');
    valid = false;
  }

  if (!data.customer_email) {
    showFieldError('customer_email', 'Email is required.');
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customer_email)) {
    showFieldError('customer_email', 'Enter a valid email address.');
    valid = false;
  }

  if (!data.message) {
    showFieldError('message', 'Please describe your complaint.');
    valid = false;
  }

  return valid;
}

function renderPhotoPreviews() {
  photoPreviewGrid.innerHTML = '';
  const files = Array.from(photoInput.files || []);

  if (!files.length) {
    photoPreviewGrid.classList.remove('visible');
    return;
  }

  files.forEach((file) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'photo-preview';

    const img = document.createElement('img');
    img.alt = file.name;
    img.src = URL.createObjectURL(file);

    wrapper.appendChild(img);
    photoPreviewGrid.appendChild(wrapper);
  });

  photoPreviewGrid.classList.add('visible');
}

if (photoInput) {
  photoInput.addEventListener('change', renderPhotoPreviews);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideBanners();

  const formData = new FormData(form);
  const payload = Object.fromEntries(
    [...formData.entries()].filter(([key]) => key !== 'photos'),
  );

  if (!validateClientSide(payload)) {
    showError('Please fix the highlighted fields and try again.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const response = await fetch('/api/complaints', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      const detail = result.errors?.join(' ') || result.message || 'Submission failed.';
      throw new Error(detail);
    }

    form.reset();
    photoPreviewGrid.innerHTML = '';
    photoPreviewGrid.classList.remove('visible');
    showSuccess(result.ticket_id, result.photos_uploaded || 0);
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Complaint';
  }
});
