import { OutletsApi } from '../auth-api.js';

export function renderOutletsView(container, { onRetry } = {}) {
  const api = new OutletsApi();
  let states = [];
  let outlets = [];
  let selectedState = '';
  let search = '';
  let debounceTimer = null;

  container.innerHTML = `
    <div class="outlets-layout">
      <div class="outlets-search-bar">
        <input id="outlets-search" type="search" placeholder="Search outlet, city, or address..." />
      </div>
      <div class="outlets-state-bar">
        <div id="outlets-states" class="outlets-states"></div>
      </div>
      <div id="outlets-status" class="view-loading">Loading outlets…</div>
      <div id="outlets-list" class="outlets-list hidden"></div>
    </div>
  `;

  const searchEl = container.querySelector('#outlets-search');
  const statesEl = container.querySelector('#outlets-states');
  const statusEl = container.querySelector('#outlets-status');
  const listEl = container.querySelector('#outlets-list');

  function renderStates() {
    statesEl.innerHTML = `
      <button type="button" class="state-chip${selectedState ? '' : ' is-active'}" data-state="">All</button>
      ${states
        .map(
          (state) => `
            <button type="button" class="state-chip${selectedState === state ? ' is-active' : ''}" data-state="${state}">
              ${state}
            </button>
          `,
        )
        .join('')}
    `;

    statesEl.querySelectorAll('.state-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        selectedState = chip.dataset.state || '';
        renderStates();
        loadOutlets();
      });
    });
  }

  function renderOutlets() {
    if (!outlets.length) {
      listEl.innerHTML = '<p class="outlets-empty">No outlets found for your search.</p>';
    } else {
      listEl.innerHTML = outlets
        .map(
          (outlet) => `
            <article class="outlet-card">
              <h3 class="outlet-card-title">${outlet.name}</h3>
              <p class="outlet-card-meta">${outlet.city}, ${outlet.state}</p>
              <p class="outlet-card-address">${outlet.address}</p>
              ${outlet.opening_hours ? `<p class="outlet-card-hours">🕐 ${outlet.opening_hours}</p>` : ''}
              <div class="outlet-card-actions">
                ${outlet.phone ? `<button type="button" class="outlet-action" data-action="call" data-phone="${outlet.phone}">📞 Call</button>` : ''}
                <button type="button" class="outlet-action" data-action="maps" data-url="${outlet.location_url || ''}" data-address="${outlet.address.replace(/"/g, '&quot;')}">📍 Directions</button>
              </div>
            </article>
          `,
        )
        .join('');

      listEl.querySelectorAll('.outlet-action').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.dataset.action === 'call' && btn.dataset.phone) {
            window.location.href = `tel:${btn.dataset.phone.replace(/\s/g, '')}`;
          } else {
            const url =
              btn.dataset.url ||
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(btn.dataset.address)}`;
            window.open(url, '_blank');
          }
        });
      });
    }

    statusEl.classList.add('hidden');
    listEl.classList.remove('hidden');
  }

  async function loadOutlets() {
    statusEl.textContent = 'Loading outlets…';
    statusEl.classList.remove('hidden');
    listEl.classList.add('hidden');

    try {
      const data = await api.listOutlets({
        state: selectedState || undefined,
        search: search.trim() || undefined,
      });
      outlets = data.outlets || [];
      renderOutlets();
    } catch (err) {
      statusEl.innerHTML = `
        <p class="form-error">${err.message || 'Could not load outlets.'}</p>
        <button type="button" class="btn-primary-block outlets-retry">Retry</button>
      `;
      statusEl.classList.remove('hidden');
      statusEl.querySelector('.outlets-retry')?.addEventListener('click', loadOutlets);
      onRetry?.(err);
    }
  }

  searchEl?.addEventListener('input', () => {
    search = searchEl.value;
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(loadOutlets, 350);
  });

  (async () => {
    try {
      const data = await api.listStates();
      states = data.states || [];
      renderStates();
      await loadOutlets();
    } catch (err) {
      statusEl.innerHTML = `<p class="form-error">${err.message}</p>`;
    }
  })();
}
