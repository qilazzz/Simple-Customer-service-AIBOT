import { CustomerSupportApi } from '../api.js';
import { getCustomerUser, isAuthenticated } from '../auth.js';

const api = new CustomerSupportApi();

function formatTicketDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getProgressState(status) {
  const normalized = String(status || 'pending').toLowerCase();
  if (normalized === 'resolved') {
    return { pending: 'done', in_progress: 'done', resolved: 'done' };
  }
  if (normalized === 'in_progress') {
    return { pending: 'done', in_progress: 'active', resolved: '' };
  }
  return { pending: 'active', in_progress: '', resolved: '' };
}

function renderProgressBar(status) {
  const steps = getProgressState(status);
  const labels = [
    { key: 'pending', label: 'Pending' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
  ];

  return `
    <div class="ticket-progress" aria-label="Ticket status progress">
      ${labels
        .map(({ key, label }) => {
          const state = steps[key];
          const className = state ? `is-${state}` : '';
          return `
            <div class="ticket-progress-step ${className}">
              <span class="ticket-progress-dot" aria-hidden="true"></span>
              <span class="ticket-progress-label">${label}</span>
            </div>`;
        })
        .join('')}
    </div>`;
}

function renderStatusUpdates(updates = []) {
  if (!updates.length) {
    return '<p class="ticket-card-muted">No status updates yet. Check the progress timeline above for your current phase.</p>';
  }

  return `
    <div class="ticket-status-updates">
      ${updates
        .map(
          (update) => `
            <article class="ticket-status-update">
              <time datetime="${update.timestamp}">${formatTicketDate(update.timestamp)}</time>
              <p>${escapeHtml(update.message_text)}</p>
            </article>`,
        )
        .join('')}
    </div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTicketCard(ticket) {
  return `
    <article class="ticket-history-card">
      <header class="ticket-history-card-header">
        <div>
          <h3 class="ticket-history-ref">#${escapeHtml(ticket.ticket_reference)}</h3>
          <time class="ticket-history-date">${formatTicketDate(ticket.created_at)}</time>
        </div>
        <span class="ticket-status-badge status-${escapeHtml(ticket.status)}">${escapeHtml(ticket.status_label)}</span>
      </header>

      ${renderProgressBar(ticket.status)}

      <div class="ticket-history-meta">
        ${ticket.order_id ? `<span class="ticket-meta-chip">Order ${escapeHtml(ticket.order_id)}</span>` : ''}
        <span class="ticket-meta-chip category">${escapeHtml(ticket.category_label)}</span>
      </div>

      <p class="ticket-history-description">${escapeHtml(ticket.description)}</p>

      <section class="ticket-history-updates">
        <h4>Status updates</h4>
        ${renderStatusUpdates(ticket.status_updates)}
      </section>
    </article>`;
}

function renderLookupForm({ email = '', phone = '', error = '' } = {}) {
  return `
    <form id="complaint-track-form" class="complaint-track-form">
      <p class="complaint-track-intro">
        Enter the same email and phone number you used when submitting your complaint.
      </p>
      <label class="field-label" for="track-email">Email</label>
      <input id="track-email" type="email" class="field-input" value="${escapeHtml(email)}" required />

      <label class="field-label" for="track-phone">Phone</label>
      <input id="track-phone" type="tel" class="field-input" value="${escapeHtml(phone)}" placeholder="+60123456789" required />

      ${error ? `<p class="form-error">${escapeHtml(error)}</p>` : ''}

      <button type="submit" class="btn-primary">View My Complaints</button>
      <button type="button" id="track-login-btn" class="btn-outline">Log in instead</button>
    </form>`;
}

function renderEmptyState() {
  return `
    <div class="ticket-history-empty">
      <p>No complaints found for this account yet.</p>
      <p class="ticket-card-muted">Submit a new issue from Customer Support → Order Issue / Complaint.</p>
    </div>`;
}

export function renderComplaintHistoryView(container, { onLogin } = {}) {
  const user = getCustomerUser();
  const authed = isAuthenticated();

  container.innerHTML = `
    <main class="scroll-content complaint-history-page">
      <section class="hero-card hero-card-menu">
        <h2 class="hero-title">Track My Complaints</h2>
        <p class="hero-sub">${authed ? `Signed in as ${escapeHtml(user?.email || user?.phone_number || 'your account')}` : 'View your submitted tickets and status updates'}</p>
      </section>

      <div id="complaint-track-panel">
        ${authed ? '<div class="ticket-history-loading">Loading your complaints…</div>' : renderLookupForm()}
      </div>

      <div id="complaint-track-results" class="ticket-history-list hidden"></div>
    </main>
  `;

  if (authed) {
    loadTrackedComplaints(container, {});
    return;
  }

  container.querySelector('#track-login-btn')?.addEventListener('click', () => onLogin?.());
  container.querySelector('#complaint-track-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = container.querySelector('#track-email')?.value.trim();
    const phone = container.querySelector('#track-phone')?.value.trim();
    await loadTrackedComplaints(container, { email, phone });
  });
}

async function loadTrackedComplaints(container, { email, phone }) {
  const panel = container.querySelector('#complaint-track-panel');
  const results = container.querySelector('#complaint-track-results');

  if (panel) {
    panel.innerHTML = '<div class="ticket-history-loading">Loading your complaints…</div>';
  }
  results?.classList.add('hidden');

  try {
    const data = await api.trackMyComplaints({ email, phone });
    const tickets = data.complaints || [];

    if (!isAuthenticated() && panel) {
      panel.innerHTML = renderLookupForm({ email, phone });
      panel.querySelector('#track-login-btn')?.addEventListener('click', () => {
        container.dispatchEvent(new CustomEvent('track-request-login'));
      });
      panel.querySelector('#complaint-track-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const nextEmail = panel.querySelector('#track-email')?.value.trim();
        const nextPhone = panel.querySelector('#track-phone')?.value.trim();
        await loadTrackedComplaints(container, { email: nextEmail, phone: nextPhone });
      });
    } else if (panel) {
      panel.innerHTML = '';
    }

    if (results) {
      results.classList.remove('hidden');
      results.innerHTML = tickets.length
        ? tickets.map((ticket) => renderTicketCard(ticket)).join('')
        : renderEmptyState();
    }
  } catch (err) {
    if (panel) {
      panel.innerHTML = isAuthenticated()
        ? `<p class="form-error">${escapeHtml(err.message)}</p>`
        : renderLookupForm({ email, phone, error: err.message });
      if (!isAuthenticated()) {
        panel.querySelector('#track-login-btn')?.addEventListener('click', () => {
          container.dispatchEvent(new CustomEvent('track-request-login'));
        });
        panel.querySelector('#complaint-track-form')?.addEventListener('submit', async (event) => {
          event.preventDefault();
          const nextEmail = panel.querySelector('#track-email')?.value.trim();
          const nextPhone = panel.querySelector('#track-phone')?.value.trim();
          await loadTrackedComplaints(container, { email: nextEmail, phone: nextPhone });
        });
      }
    }
  }
}
