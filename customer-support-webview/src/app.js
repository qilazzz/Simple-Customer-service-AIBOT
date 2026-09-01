/**
 * Support menu entry — mirrors mobile CustomerServiceMenuScreen.
 */

import { API_BASE_URL, readLaunchContext } from './config.js';
import { bootstrapCustomerAuth, clearCustomerSession, getCustomerUser, isAuthenticated } from './auth/customerAuth.js';
import { initNativeBridge, onNativeBridgeEvent } from './bridge/nativeBridge.js';

export const SUPPORT_MENU = [
  { id: 'find_outlet', emoji: '📍', label: 'Find an Outlet', href: null, external: true },
  { id: 'order_status', emoji: '🛵', label: 'Order Status' },
  { id: 'order_issue', emoji: '🧾', label: 'Order Issue / Complaint' },
  { id: 'menu', emoji: '🍕', label: 'Menu' },
  { id: 'promotions', emoji: '🏷️', label: 'Promotions & Offers' },
  { id: 'other', emoji: '💬', label: 'Other / Talk to Support', meta: 'Opens your saved live agent conversation' },
];

function buildQuerySuffix() {
  const params = new URLSearchParams(window.location.search);
  const keep = ['apiBase', 'api_base', 'token', 'user_id', 'userId', 'guest'];
  const next = new URLSearchParams();
  keep.forEach((key) => {
    if (params.get(key)) next.set(key, params.get(key));
  });
  const qs = next.toString();
  return qs ? `?${qs}` : '';
}

function renderAuthUi() {
  const badge = document.getElementById('auth-badge');
  const authBar = document.getElementById('auth-bar');
  const authUserEl = document.getElementById('auth-bar-user');
  const user = getCustomerUser();

  if (isAuthenticated() && user) {
    badge.textContent = user.name || user.email || 'Signed in';
    authBar?.classList.remove('hidden');
    if (authUserEl) {
      authUserEl.textContent = user.email || user.name || user.user_id || 'Signed in';
    }
  } else {
    badge.textContent = 'Guest';
    authBar?.classList.add('hidden');
  }
}

function renderMenu() {
  const menuEl = document.getElementById('support-menu');
  if (!menuEl) return;

  const qs = buildQuerySuffix();

  menuEl.innerHTML = SUPPORT_MENU.map((item) => {
    const meta = item.meta ? `<span class="menu-option-meta">${item.meta}</span>` : '';
    return `
      <button type="button" class="menu-option" data-option-id="${item.id}">
        <span class="menu-option-emoji">${item.emoji}</span>
        <span class="menu-option-copy">
          <span class="menu-option-label">${item.label}</span>
          ${meta}
        </span>
      </button>
    `;
  }).join('');

  menuEl.querySelectorAll('.menu-option').forEach((button) => {
    button.addEventListener('click', () => {
      const optionId = button.dataset.optionId;
      handleMenuSelection(optionId, qs);
    });
  });
}

function handleMenuSelection(optionId, qs) {
  if (optionId === 'other') {
    window.location.href = `/pages/live-chat.html${qs}`;
    return;
  }

  if (optionId === 'find_outlet') {
    const outletsUrl = API_BASE_URL ? `${API_BASE_URL}/outlets.html` : '/outlets.html';
    window.open(outletsUrl, '_blank');
    return;
  }

  const item = SUPPORT_MENU.find((entry) => entry.id === optionId);
  const params = new URLSearchParams(qs.replace(/^\?/, ''));
  if (item?.label) params.set('option', item.label);
  if (optionId) params.set('optionId', optionId);
  const nextQs = params.toString();
  window.location.href = `/pages/bot-chat.html${nextQs ? `?${nextQs}` : ''}`;
}

export async function initSupportMenuApp() {
  initNativeBridge();
  await bootstrapCustomerAuth();
  renderAuthUi();
  renderMenu();

  onNativeBridgeEvent(() => {
    renderAuthUi();
  });

  document.getElementById('auth-logout-btn')?.addEventListener('click', () => {
    clearCustomerSession();
    renderAuthUi();
  });

  const launch = readLaunchContext();
  if (launch.apiBase) {
    console.info('[Support WebView] API base:', API_BASE_URL || window.location.origin);
  }
}

if (document.getElementById('support-menu')) {
  initSupportMenuApp();
}
