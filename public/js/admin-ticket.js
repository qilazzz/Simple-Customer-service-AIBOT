requireAuth();

const params = new URLSearchParams(window.location.search);
const ticketId = params.get('id');

if (!ticketId) {
  window.location.href = '/admin/index.html';
}

const contentEl = document.getElementById('ticket-content');
const pageTitleEl = document.getElementById('ticket-page-title-text');
const photoModal = document.getElementById('photo-modal');
const photoModalImg = document.getElementById('photo-modal-img');

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('back-btn').addEventListener('click', () => {
  window.location.href = '/admin/index.html';
});

photoModal.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-modal]')) {
    closePhotoModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !photoModal.classList.contains('hidden')) {
    closePhotoModal();
  }
});

function formatTicketNumber(id) {
  return `CMP-${String(id).padStart(3, '0')}`;
}

function parseMarkdown(text) {
  if (!text) return '';

  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

function formatAiSummary(summary) {
  const text = String(summary || '').trim();
  return text || 'Summary unavailable';
}

function formatSentimentLabel(sentiment) {
  const labels = {
    positive: 'Positive',
    neutral: 'Neutral',
    frustrated: 'Frustrated',
    urgent: 'Urgent',
    negative: 'Negative',
    angry: 'Angry',
  };
  const key = String(sentiment || 'neutral').toLowerCase();
  return labels[key] || 'Neutral';
}

function getCustomerFields(complaint) {
  const email =
    complaint.customer_email ||
    (complaint.customer_contact?.includes('@') ? complaint.customer_contact : null) ||
    '—';
  const phone =
    complaint.customer_phone ||
    (complaint.customer_contact && !complaint.customer_contact.includes('@')
      ? complaint.customer_contact
      : null) ||
    '—';

  return {
    name: complaint.customer_name || '—',
    email,
    phone,
    orderId: complaint.order_id || '—',
  };
}

function getPhotoUrls(complaint) {
  if (complaint.attachment_urls?.length) return complaint.attachment_urls;
  if (complaint.photos?.length) return complaint.photos.map((photo) => photo.url);
  return [];
}

function renderPhotos(urls) {
  if (!urls.length) {
    return '<p class="photo-empty">No attachments uploaded.</p>';
  }

  return `<div class="photo-gallery">${urls
    .map(
      (url, index) => `
        <button type="button" class="photo-thumb" data-photo-url="${escapeHtml(url)}" aria-label="View attachment ${index + 1}">
          <img src="${escapeHtml(url)}" alt="Attachment ${index + 1}" loading="lazy" />
        </button>`,
    )
    .join('')}</div>`;
}

function getBubbleRole(sender) {
  const role = String(sender || '').toLowerCase();
  if (role === 'customer') return 'customer';
  if (role === 'admin') return 'admin';
  return 'bot';
}

function renderTranscript(messages) {
  if (!messages?.length) {
    return '<p class="transcript-empty">No chat messages logged for this ticket.</p>';
  }

  return messages
    .map((message) => {
      const role = getBubbleRole(message.sender);
      const label =
        role === 'customer' ? 'Customer' : role === 'admin' ? 'Admin' : 'Support Bot';

      return `
        <div class="msg-bubble-wrap is-${role}">
          <div class="msg-bubble-meta">${escapeHtml(label)} · ${formatDate(message.timestamp)}</div>
          <div class="msg-bubble is-${role}">${parseMarkdown(message.message_text)}</div>
        </div>`;
    })
    .join('');
}

function openPhotoModal(url) {
  photoModalImg.src = url;
  photoModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closePhotoModal() {
  photoModal.classList.add('hidden');
  photoModalImg.src = '';
  document.body.style.overflow = '';
}

function bindPhotoThumbs() {
  contentEl.querySelectorAll('.photo-thumb[data-photo-url]').forEach((button) => {
    button.addEventListener('click', () => {
      openPhotoModal(button.dataset.photoUrl);
    });
  });
}

function scrollTranscriptToBottom() {
  const transcript = contentEl.querySelector('.transcript-scroll');
  if (transcript) {
    transcript.scrollTop = transcript.scrollHeight;
  }
}

function setPageTitle(ticketNumber) {
  const title = `Ticket Detail - #${ticketNumber}`;
  pageTitleEl.textContent = title;
  document.title = `${title} — US Pizza Admin`;
}

function renderTicket(complaint) {
  const ticketNumber = formatTicketNumber(complaint.id);
  const customer = getCustomerFields(complaint);
  const aiSummary = formatAiSummary(complaint.ai_summary);
  const sentimentLabel = formatSentimentLabel(complaint.sentiment);
  const sentimentClass = String(complaint.sentiment || 'neutral').toLowerCase();
  const photos = getPhotoUrls(complaint);
  const statusClass = String(complaint.status || 'pending').replace(/\s+/g, '_');

  setPageTitle(ticketNumber);

  contentEl.innerHTML = `
    <div class="ticket-dashboard">
      <div class="ticket-column ticket-column-main">
        <section class="ticket-card">
          <div class="ticket-status-header">
            <div class="ticket-badge-row">
              <span class="ticket-badge status-${statusClass}">${escapeHtml(complaint.status_label)}</span>
              <span class="ticket-badge priority-${complaint.priority}">${escapeHtml(complaint.priority)}</span>
              <span class="ticket-badge category">${escapeHtml(complaint.category_label)}</span>
            </div>
            <time class="ticket-created">${formatDate(complaint.created_at)}</time>
          </div>
        </section>

        <section class="ticket-card">
          <h2 class="ticket-card-title">Customer Information</h2>
          <div class="customer-grid">
            <div class="customer-field">
              <span>Name</span>
              <strong>${escapeHtml(customer.name)}</strong>
            </div>
            <div class="customer-field">
              <span>Order ID</span>
              <strong>${escapeHtml(customer.orderId)}</strong>
            </div>
            <div class="customer-field">
              <span>Email</span>
              <strong id="customer-email">${escapeHtml(customer.email)}</strong>
            </div>
            <div class="customer-field">
              <span>Phone</span>
              <strong>${escapeHtml(customer.phone)}</strong>
            </div>
          </div>
        </section>

        <section class="ticket-card">
          <h2 class="ticket-card-title">AI Summary & Sentiment</h2>
          <div class="ai-callout">
            <p class="ai-callout-label">✨ AI Summary</p>
            <p class="ai-summary-text">${escapeHtml(aiSummary)}</p>
          </div>
          <div class="ai-sentiment-row">
            <span class="ticket-card-title-sm" style="margin:0">Sentiment</span>
            <span class="sentiment-badge sentiment-${sentimentClass}">${escapeHtml(sentimentLabel)}</span>
          </div>
        </section>

        <section class="ticket-card">
          <h2 class="ticket-card-title">Description</h2>
          <blockquote class="description-quote">
            ${parseMarkdown(complaint.description)}
          </blockquote>
        </section>

        <section class="ticket-card">
          <h2 class="ticket-card-title">Proof / Photos</h2>
          ${renderPhotos(photos)}
        </section>
      </div>

      <div class="ticket-column ticket-column-side">
        <section class="ticket-card">
          <h2 class="ticket-card-title">Update Status</h2>
          <select id="status-select" class="ticket-select" aria-label="Ticket status">
            <option value="pending" ${complaint.status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="in_progress" ${complaint.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
            <option value="resolved" ${complaint.status === 'resolved' ? 'selected' : ''}>Resolved</option>
          </select>
          <button id="save-status" type="button" class="ticket-action-btn">Save Status</button>
        </section>

        <section class="ticket-card">
          <h2 class="ticket-card-title">Reply to Customer</h2>
          <form id="reply-form">
            <label class="ticket-field-label" for="email-subject">Subject</label>
            <input
              id="email-subject"
              type="text"
              class="ticket-input"
              value="${escapeHtml(`Re: US Pizza Complaint Ticket #${complaint.id}`)}"
            />
            <label class="ticket-field-label" for="reply-text-area">Message</label>
            <textarea
              id="reply-text-area"
              class="ticket-textarea"
              rows="5"
              placeholder="Write your response to the customer..."
            ></textarea>
            <div class="ticket-reply-actions">
              <button type="submit" class="ticket-action-btn">Send Email Reply</button>
              <button type="button" id="open-email-client-btn" class="ticket-action-btn ticket-action-btn-secondary">
                Draft in Email Client
              </button>
            </div>
          </form>
          <div id="email-mock" class="email-mock hidden"></div>
        </section>

        <section class="ticket-card">
          <h2 class="ticket-card-title">Chat Transcript</h2>
          <div class="transcript-scroll">${renderTranscript(complaint.messages)}</div>
        </section>
      </div>
    </div>
  `;

  document.getElementById('save-status').addEventListener('click', saveStatus);
  document.getElementById('reply-form').addEventListener('submit', sendReply);
  document.getElementById('open-email-client-btn')?.addEventListener('click', openEmailClient);
  bindPhotoThumbs();
  scrollTranscriptToBottom();
}

function getReplyDraft() {
  return {
    subject: document.getElementById('email-subject')?.value ?? '',
    message: document.getElementById('reply-text-area')?.value ?? '',
  };
}

function restoreReplyDraft(draft = {}) {
  const subjectEl = document.getElementById('email-subject');
  const messageEl = document.getElementById('reply-text-area');
  if (subjectEl && draft.subject !== undefined) subjectEl.value = draft.subject;
  if (messageEl && draft.message !== undefined) messageEl.value = draft.message;
}

function getReplyEmailAddress() {
  const emailEl = document.getElementById('customer-email');
  const email = emailEl?.textContent.trim() || '';
  if (!email || email === '—' || !email.includes('@')) {
    return null;
  }
  return email;
}

function openEmailClient() {
  const customerEmail = getReplyEmailAddress();
  if (!customerEmail) {
    alert('No valid customer email is available for this ticket.');
    return;
  }

  const subjectInput = document.getElementById('email-subject')?.value ?? '';
  const bodyText = document.getElementById('reply-text-area')?.value ?? '';

  const encodedTo = encodeURIComponent(customerEmail);
  const encodedSubject = encodeURIComponent(subjectInput);
  const encodedBody = encodeURIComponent(bodyText);

  const mailtoUrl = `mailto:${encodedTo}?subject=${encodedSubject}&body=${encodedBody}`;

  // Opens the default mail app without clearing the form fields on this page.
  window.location.href = mailtoUrl;
}

async function loadTicket() {
  contentEl.innerHTML = `
    <div class="ticket-loading clay-card">
      <div class="ticket-loading-spinner" aria-hidden="true"></div>
      <p>Loading ticket...</p>
    </div>
  `;
  setPageTitle(formatTicketNumber(ticketId));

  try {
    const res = await adminFetch(`/api/admin/complaints/${ticketId}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    renderTicket(data.complaint);
  } catch (err) {
    contentEl.innerHTML = `<div class="ticket-error clay-card">${escapeHtml(err.message)}</div>`;
  }
}

async function saveStatus() {
  const button = document.getElementById('save-status');
  if (!button) return;

  const replyDraft = getReplyDraft();
  button.disabled = true;
  try {
    const res = await adminFetch(`/api/admin/complaints/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: document.getElementById('status-select').value }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    renderTicket(data.complaint);
    restoreReplyDraft(replyDraft);
  } catch (err) {
    alert(err.message);
    const retryBtn = document.getElementById('save-status');
    if (retryBtn) retryBtn.disabled = false;
  }
}

async function sendReply(event) {
  event.preventDefault();

  const textarea = document.getElementById('reply-text-area');
  const message_text = textarea.value.trim();
  if (!message_text) return;

  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const replyDraft = getReplyDraft();

  try {
    const res = await adminFetch(`/api/admin/complaints/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message_text }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    const mock = data.email_mock;
    renderTicket(data.complaint);
    restoreReplyDraft(replyDraft);

    const emailMockEl = document.getElementById('email-mock');
    emailMockEl.classList.remove('hidden');
    emailMockEl.innerHTML = `
      <strong>Email mockup sent</strong><br>
      To: ${escapeHtml(mock.to)}<br>
      Subject: ${escapeHtml(mock.subject)}<br>
      Body: ${escapeHtml(mock.body)}
    `;
  } catch (err) {
    alert(err.message);
    const retryBtn = document.querySelector('#reply-form button[type="submit"]');
    if (retryBtn) retryBtn.disabled = false;
  }
}

loadTicket();
