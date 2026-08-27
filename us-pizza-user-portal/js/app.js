import { SUPPORT_MENU } from './config.js';
import {
  bootstrapCustomerAuth,
  getCustomerUser,
  getFirstName,
  isAuthenticated,
} from './auth.js';
import { loginCustomer, registerCustomer, logoutCustomer } from './auth-api.js';
import { initFloatingSupportButton } from './floating-button.js';
import { renderHomeView } from './views/home.js';
import { renderMenuView } from './views/menu.js';
import { renderLoginView, renderRegisterView } from './views/auth.js';
import { renderOutletsView } from './views/outlets.js';
import { renderFaqView } from './views/faq.js';
import { createBotChatController } from './views/bot-chat.js';
import { createLiveChatController } from './views/live-chat.js';

const VIEWS = ['home', 'outlets', 'menu', 'bot', 'live', 'login', 'register', 'faq'];

let currentView = 'home';
let navParams = {};
let botController = null;
let liveController = null;
let guestModalResolver = null;

const fabLayer = document.getElementById('fab-layer');
const headerBack = document.getElementById('header-back');
const headerTitle = document.getElementById('header-title');
const authChip = document.getElementById('auth-chip');
const guestModal = document.getElementById('guest-modal');
const guestModalTitle = document.getElementById('guest-modal-title');
const guestModalDesc = document.getElementById('guest-modal-desc');
const fab = document.getElementById('support-fab');

function getTitle(view, params = {}) {
  switch (view) {
    case 'home':
      return 'US Pizza';
    case 'outlets':
      return 'Find Outlets';
    case 'menu':
      return 'Customer Service';
    case 'bot':
      return params.initialOption || 'Support Assistant';
    case 'live':
      return 'Talk to Support';
    case 'login':
      return 'Log In';
    case 'register':
      return 'Register';
    case 'faq':
      return 'FAQ';
    default:
      return 'US Pizza';
  }
}

function showView(name, params = {}) {
  currentView = name;
  VIEWS.forEach((view) => {
    document.getElementById(`view-${view}`)?.classList.toggle('hidden', view !== name);
  });

  headerTitle.textContent = getTitle(name, params);
  headerBack.classList.toggle('hidden', name === 'home');
  authChip?.classList.toggle('hidden', name !== 'home');

  const showFab = name === 'home';
  fab?.classList.toggle('hidden', !showFab);
  fabLayer?.classList.toggle('hidden', !showFab);

  if (name !== 'live' && liveController) {
    liveController.stop();
  }
}

function openGuestModal(config = {}) {
  guestModalTitle.textContent = config.title || 'Customer Support';
  guestModalDesc.textContent =
    config.message ||
    'Sign in for faster support and saved details, or continue as a guest.';

  return new Promise((resolve) => {
    guestModalResolver = resolve;
    guestModal?.classList.remove('hidden');
  });
}

function closeGuestModal(result) {
  guestModal?.classList.add('hidden');
  guestModalResolver?.(result);
  guestModalResolver = null;
}

async function promptSupportAccess() {
  if (isAuthenticated()) {
    navigateTo('menu');
    return;
  }

  const choice = await openGuestModal({
    title: 'Customer Support',
    message: 'Sign in for faster support and saved details, or continue as a guest.',
  });

  if (choice === 'guest') navigateTo('menu', { guest: true });
  else if (choice === 'login') navigateTo('login', { redirect: 'menu' });
  else if (choice === 'register') navigateTo('register', { redirect: 'menu' });
}

async function promptLiveSupportAccess() {
  if (isAuthenticated()) {
    navigateTo('live');
    return;
  }

  const choice = await openGuestModal({
    title: 'Talk to Support',
    message: 'Sign in to restore your live chat history, or continue as a guest.',
  });

  if (choice === 'guest') navigateTo('live', { guest: true });
  else if (choice === 'login') {
    navigateTo('login', { redirect: 'live', redirectParams: { guest: false } });
  } else if (choice === 'register') {
    navigateTo('register', { redirect: 'live', redirectParams: { guest: false } });
  }
}

function finishAuthRedirect() {
  const { redirect, redirectParams } = navParams;
  if (redirect === 'live') {
    navigateTo('live', redirectParams || {});
    return;
  }
  if (redirect === 'menu') {
    navigateTo('menu');
    return;
  }
  navigateBack();
}

function navigateBack() {
  if (currentView === 'live' || currentView === 'bot') navigateTo('menu');
  else if (currentView === 'menu') navigateTo('home');
  else if (currentView === 'outlets' || currentView === 'faq') navigateTo('home');
  else if (currentView === 'login' || currentView === 'register') navigateTo('home');
  else navigateTo('home');
}

function navigateTo(view, options = {}) {
  navParams = options;

  if (view === 'bot') {
    showView('bot', options);
    const container = document.getElementById('view-bot');
    container.innerHTML = '';
    botController = createBotChatController(container, {
      onOpenOutlets: () => navigateTo('outlets'),
      onTicketSubmitted: (ticketId) => {
        window.alert(`Complaint logged\n\nYour ticket #${ticketId} has been sent to our team.`);
        navigateTo('menu');
      },
    });
    botController.start(options.initialOption || null);
    return;
  }

  if (view === 'live') {
    showView('live', options);
    const container = document.getElementById('view-live');
    container.innerHTML = '';
    const guestMode = options.guest === true && !isAuthenticated();
    liveController = createLiveChatController(container, {
      guestMode,
      onRequestLogin: () =>
        navigateTo('login', {
          redirect: 'live',
          redirectParams: { guest: false },
        }),
      onLogout: async () => {
        await logoutCustomer();
        updateAuthChip();
        navigateTo('live', { guest: true });
      },
    });
    liveController.start();
    return;
  }

  if (view === 'menu') {
    showView('menu', options);
    renderMenuView(document.getElementById('view-menu'), {
      onSelectOption: handleMenuOption,
    });
    return;
  }

  if (view === 'outlets') {
    showView('outlets', options);
    renderOutletsView(document.getElementById('view-outlets'));
    return;
  }

  if (view === 'faq') {
    showView('faq', options);
    renderFaqView(document.getElementById('view-faq'), {
      onFindOutlets: () => navigateTo('outlets'),
      onOpenSupport: promptSupportAccess,
    });
    return;
  }

  if (view === 'login') {
    showView('login', options);
    renderLoginView(document.getElementById('view-login'), {
      error: options.error || '',
      onSubmit: async ({ identifier, password }) => {
        try {
          await loginCustomer(identifier, password);
          updateAuthChip();
          finishAuthRedirect();
        } catch (err) {
          navigateTo('login', { ...options, error: err.message });
        }
      },
      onGoRegister: () => navigateTo('register', options),
    });
    return;
  }

  if (view === 'register') {
    showView('register', options);
    renderRegisterView(document.getElementById('view-register'), {
      error: options.error || '',
      onSubmit: async (payload) => {
        try {
          await registerCustomer(payload);
          updateAuthChip();
          finishAuthRedirect();
        } catch (err) {
          navigateTo('register', { ...options, error: err.message });
        }
      },
      onGoLogin: () => navigateTo('login', options),
    });
    return;
  }

  showView('home', options);
  renderHomeView(document.getElementById('view-home'), {
    onFindOutlets: () => navigateTo('outlets'),
    onOpenSupport: promptSupportAccess,
    onOpenFaq: () => navigateTo('faq'),
  });
}

function handleMenuOption(optionId) {
  if (optionId === 'find_outlet') {
    navigateTo('outlets');
    return;
  }

  if (optionId === 'other') {
    promptLiveSupportAccess();
    return;
  }

  const item = SUPPORT_MENU.find((entry) => entry.id === optionId);
  navigateTo('bot', { initialOption: item?.label });
}

function updateAuthChip() {
  if (!authChip) return;

  if (isAuthenticated()) {
    const user = getCustomerUser();
    authChip.innerHTML = `
      <span class="auth-avatar">${getFirstName(user?.name).charAt(0).toUpperCase()}</span>
      <span>Hi, ${getFirstName(user?.name)}</span>
    `;
    authChip.onclick = async () => {
      const detail = user?.email || user?.phone_number || 'US Pizza member';
      if (window.confirm(`Hi, ${getFirstName(user?.name)}\n${detail}\n\nLog out?`)) {
        await logoutCustomer();
        updateAuthChip();
      }
    };
  } else {
    authChip.innerHTML = '<span>Login / Register</span>';
    authChip.onclick = () => navigateTo('login');
  }
}

headerBack?.addEventListener('click', navigateBack);

document.getElementById('guest-login-btn')?.addEventListener('click', () => closeGuestModal('login'));
document.getElementById('guest-register-btn')?.addEventListener('click', () => closeGuestModal('register'));
document.getElementById('guest-continue-btn')?.addEventListener('click', () => closeGuestModal('guest'));
guestModal?.querySelectorAll('[data-close-modal]').forEach((el) => {
  el.addEventListener('click', () => closeGuestModal('cancel'));
});

window.addEventListener('message', (event) => {
  try {
    const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (payload?.type === 'AUTH_SESSION' && payload.token) {
      import('./auth.js').then(({ setCustomerSession }) => {
        setCustomerSession(payload.token, payload.user || null);
        updateAuthChip();
      });
    }
  } catch {
    // Ignore non-JSON messages.
  }
});

async function init() {
  // Render home immediately — do not block UI on auth/API session check.
  navigateTo('home');
  updateAuthChip();

  initFloatingSupportButton({
    button: fab,
    layer: fabLayer,
    onPress: promptSupportAccess,
  });

  try {
    await bootstrapCustomerAuth();
    updateAuthChip();
  } catch (err) {
    console.warn('Auth bootstrap skipped:', err);
  }
}

init().catch((err) => {
  console.error('Portal init failed:', err);
  document.getElementById('view-home')?.insertAdjacentHTML(
    'beforeend',
    '<p class="form-error" style="margin:1rem">Could not start the app. Please refresh the page.</p>',
  );
});
