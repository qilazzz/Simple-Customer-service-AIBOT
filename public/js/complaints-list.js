function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPhotos(photos) {
  if (!photos?.length) {
    return '<div class="no-photos">No photos attached.</div>';
  }

  return `
    <div class="complaint-photos">
      ${photos
        .map(
          (photo) => `
            <a href="${escapeHtml(photo.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(photo.original_name || 'Complaint photo')}">
              <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.original_name || 'Complaint photo')}" loading="lazy" />
            </a>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderComplaintCard(complaint) {
  return `
    <article class="complaint-card">
      <div class="complaint-header">
        <h2 class="complaint-title">Ticket #${complaint.ticket_id}</h2>
        <div class="complaint-meta">
          <span class="chip status-${complaint.status}">${complaint.status.replace('_', ' ')}</span>
          <span class="chip category">${escapeHtml(complaint.category_label)}</span>
        </div>
      </div>

      <div class="complaint-details">
        <div><strong>Name:</strong> ${escapeHtml(complaint.customer_name)}</div>
        <div><strong>Email:</strong> ${escapeHtml(complaint.customer_email)}</div>
        ${complaint.customer_phone ? `<div><strong>Phone:</strong> ${escapeHtml(complaint.customer_phone)}</div>` : ''}
        ${complaint.order_id ? `<div><strong>Order ID:</strong> ${escapeHtml(complaint.order_id)}</div>` : ''}
        <div><strong>Submitted:</strong> ${formatDate(complaint.created_at)}</div>
      </div>

      <p class="complaint-message">${escapeHtml(complaint.message)}</p>
      ${renderPhotos(complaint.photos)}
    </article>
  `;
}

async function loadComplaints() {
  const statsBar = document.getElementById('stats-bar');
  const listEl = document.getElementById('complaints-list');
  const emptyEl = document.getElementById('empty-state');
  const loadingEl = document.getElementById('loading-state');

  loadingEl.classList.add('visible');
  emptyEl.classList.remove('visible');
  listEl.innerHTML = '';

  try {
    const response = await fetch('/api/complaints');
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to load complaints.');
    }

    const { complaints, count } = result;
    statsBar.innerHTML = `
      <span class="stat-pill">${count} total complaint${count === 1 ? '' : 's'}</span>
      <span class="stat-pill">${complaints.filter((c) => c.status === 'pending').length} pending</span>
      <span class="stat-pill">${complaints.reduce((sum, c) => sum + (c.photos?.length || 0), 0)} photo(s)</span>
    `;

    if (!complaints.length) {
      emptyEl.classList.add('visible');
      return;
    }

    listEl.innerHTML = complaints.map(renderComplaintCard).join('');
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  } finally {
    loadingEl.classList.remove('visible');
  }
}

loadComplaints();
