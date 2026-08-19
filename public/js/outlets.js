const searchEl = document.getElementById('outlet-search');
const stateFiltersEl = document.getElementById('state-filters');
const statusEl = document.getElementById('outlets-status');
const listEl = document.getElementById('outlets-list');

let states = [];
let selectedState = '';
let searchTimer = null;

function setStatus(text) {
  statusEl.textContent = text || '';
}

function renderStates() {
  stateFiltersEl.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = `state-chip${selectedState ? '' : ' active'}`;
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => {
    selectedState = '';
    renderStates();
    loadOutlets();
  });
  stateFiltersEl.appendChild(allBtn);

  states.forEach((state) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `state-chip${selectedState === state ? ' active' : ''}`;
    btn.textContent = state;
    btn.addEventListener('click', () => {
      selectedState = state;
      renderStates();
      loadOutlets();
    });
    stateFiltersEl.appendChild(btn);
  });
}

function renderOutlets(outlets) {
  listEl.innerHTML = '';

  if (!outlets.length) {
    listEl.innerHTML = '<p class="outlets-empty">No outlets found for your search.</p>';
    return;
  }

  outlets.forEach((outlet) => {
    const card = document.createElement('article');
    card.className = 'outlet-card';

    const mapsUrl =
      outlet.location_url ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(outlet.address)}`;

    card.innerHTML = `
      <h3>${escapeHtml(outlet.name)}</h3>
      <div class="outlet-meta">${escapeHtml(outlet.city)}, ${escapeHtml(outlet.state)}</div>
      <p class="outlet-address">${escapeHtml(outlet.address)}</p>
      ${outlet.opening_hours ? `<p class="outlet-hours">🕐 ${escapeHtml(outlet.opening_hours)}</p>` : ''}
      <div class="outlet-actions">
        ${outlet.phone ? `<a href="tel:${outlet.phone.replace(/\s/g, '')}">📞 Call</a>` : ''}
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">📍 Directions</a>
      </div>
    `;

    listEl.appendChild(card);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadOutlets() {
  setStatus('Loading outlets...');
  listEl.innerHTML = '';

  const params = new URLSearchParams();
  if (selectedState) params.set('state', selectedState);
  if (searchEl.value.trim()) params.set('search', searchEl.value.trim());

  try {
    const res = await fetch(`/api/outlets?${params.toString()}`);
    const data = await res.json();

    if (!res.ok || data.success === false) {
      throw new Error(data.message || 'Could not load outlets.');
    }

    setStatus(`${data.count} outlet${data.count === 1 ? '' : 's'} found`);
    renderOutlets(data.outlets || []);
  } catch (err) {
    setStatus('');
    listEl.innerHTML = `<p class="outlets-error">${escapeHtml(err.message)}</p>`;
  }
}

async function init() {
  try {
    const res = await fetch('/api/outlets/states');
    const data = await res.json();
    states = data.states || [];
    renderStates();
  } catch (_err) {
    states = [];
  }

  await loadOutlets();
}

searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadOutlets, 350);
});

init();
