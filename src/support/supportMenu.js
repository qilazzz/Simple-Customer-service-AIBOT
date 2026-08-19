const company = require('../companyKnowledge');

/** @type {{ id: string, emoji: string, label: string }[]} */
const SUPPORT_MENU = [
  { id: 'find_outlet', emoji: '📍', label: 'Find an Outlet' },
  { id: 'order_status', emoji: '🛵', label: 'Order Status' },
  { id: 'order_issue', emoji: '🧾', label: 'Order Issue / Complaint' },
  { id: 'menu', emoji: '🍕', label: 'Menu' },
  { id: 'promotions', emoji: '🏷️', label: 'Promotions & Offers' },
  { id: 'other', emoji: '💬', label: 'Other / Talk to Support' },
];

function getMenuWelcomeText() {
  return (
    'Hello! Welcome to **US Pizza Malaysia Support**.\n\n' +
    'How can we help you today? Ask a question or tap an option below.'
  );
}

/** Strip legacy separators and numbered-menu instructions from bot text. */
function cleanBotReply(text) {
  if (!text) return '';
  return String(text)
    .replace(/\n---\n[\s\S]*$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {string} text
 * @returns {string|null} menu item id
 */
function parseMenuChoice(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const num = parseInt(trimmed, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= SUPPORT_MENU.length) {
    return SUPPORT_MENU[num - 1].id;
  }

  const lower = trimmed.toLowerCase();
  for (const item of SUPPORT_MENU) {
    const labelLower = item.label.toLowerCase();
    if (lower === labelLower || lower.includes(labelLower)) {
      return item.id;
    }
  }

  if (/\boutlet\b|\blocation\b|\bbranch\b|\bfind\b|\baddress\b/.test(lower)) return 'find_outlet';
  if (
    /\bstatus\b|\btrack\b|\bwhere is my order\b|\bwhere is my pizza\b|\bwhere's my pizza\b|\bmy order\b/.test(
      lower,
    )
  ) {
    return 'order_status';
  }
  if (/\bcomplaint\b|\bissue\b|\bproblem\b|\bwrong\b|\bbad\b|\brefund\b|\bpayment\b/.test(lower)) {
    return 'order_issue';
  }
  if (/\bpromo\b|\bpromotion\b|\bdeal\b|\boffer\b|\bvoucher\b|\bdiscount\b/.test(lower)) {
    return 'promotions';
  }
  if (/\bmenu\b|\bpizza menu\b|\bsides?\b|\bdrinks?\b/.test(lower)) return 'menu';

  return null;
}

function isBackToMenuCommand(text) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Main menu option label — handled by parseMenuChoice, not a back command
  if (lower === 'menu') return false;

  return (
    /\b(back|home|start over|main menu)\b/i.test(trimmed) ||
    /\bback to (the )?main menu\b/i.test(trimmed)
  );
}

async function getFindOutletReply(userMessage = '') {
  const outletService = require('../outlets/outletService');
  const {
    extractStateFromText,
    extractUnmatchedLocationHint,
  } = require('../outlets/outletStateParser');

  const knownStates = await outletService.listStates();
  const state = extractStateFromText(userMessage, knownStates);

  if (state) {
    const outlets = await outletService.listOutlets({ state });
    const count = outlets.length;

    if (count === 0) {
      return (
        `**Find an Outlet — ${state}**\n\n` +
        `Sorry, we couldn't find any US Pizza outlets in **${state}**.\n\n` +
        `Available states: ${knownStates.join(', ')}.\n\n` +
        'Open **Find Outlets** (/outlets.html) to search all locations.'
      );
    }

    const preview = outlets.slice(0, 10);
    const lines = preview
      .map(
        (outlet, index) =>
          `${index + 1}. **${outlet.name}** — ${outlet.city}, ${outlet.state}` +
          (outlet.phone ? `\n   📞 ${outlet.phone}` : ''),
      )
      .join('\n');

    const moreText = count > preview.length ? `\n\n...and ${count - preview.length} more.` : '';

    return (
      `**Find an Outlet — ${state}**\n\n` +
      `Found **${count}** outlet${count === 1 ? '' : 's'} in **${state}**:\n\n` +
      `${lines}${moreText}\n\n` +
      'Open **Find Outlets** (/outlets.html) for directions and full details.'
    );
  }

  const unmatchedHint = extractUnmatchedLocationHint(userMessage);
  if (unmatchedHint) {
    return (
      '**Find an Outlet**\n\n' +
      `Sorry, we couldn't match **"${unmatchedHint}"** to a state.\n\n` +
      'Please try again with a valid state, for example:\n' +
      `${knownStates.map((item) => `• ${item}`).join('\n')}\n\n` +
      'Open **Find Outlets** (/outlets.html) to browse all locations.'
    );
  }

  const total = await outletService.countOutlets();
  const preview = await outletService.listOutlets({ limit: 5 });
  const lines = preview
    .map(
      (outlet, index) =>
        `${index + 1}. **${outlet.name}** — ${outlet.city}, ${outlet.state}`,
    )
    .join('\n');

  return (
    `**Find an Outlet**\n\n` +
    `We have **${total}** US Pizza outlets across Malaysia.\n\n` +
    `${lines}\n\n` +
    'Tip: type a state name, e.g. **outlet in Perak**.\n\n' +
    'Open **Find Outlets** (/outlets.html) to search by state, city, or outlet name.'
  );
}

/**
 * @param {string} menuId
 * @param {string} [userMessage]
 */
async function getInfoReply(menuId, userMessage = '') {
  switch (menuId) {
    case 'find_outlet':
      return getFindOutletReply(userMessage);

    case 'menu':
      return 'What would you like to explore in our menu today?';

    case 'promotions':
      return (
        `**Promotions & Offers**\n\n` +
        `${company.promotions}\n\n` +
        `Accepted payment: ${company.paymentMethods.join(', ')}.\n\n` +
        `Call **${company.phoneNumber}** for the latest vouchers and discounts.`
      );

    case 'other':
      return (
        `**Talk to Support**\n\n` +
        `• Call: **${company.phoneNumber}**\n` +
        `• ${company.contactPerson.name}: **${company.contactPerson.phone}**\n\n` +
        'Type your question below and we will guide you. ' +
        'For order problems, choose **Order Issue / Complaint** from the menu.'
      );

    default:
      return 'How can we help you today?';
  }
}

function getOrderStatusPrompt() {
  return 'Please share your **Order ID** or receipt number and I will check the status for you.';
}

/**
 * @param {string} orderId
 */
function getOrderStatusReply(orderId) {
  return (
    `**Order Status — ${orderId}**\n\n` +
    `Thank you! Orders are typically prepared within 15–20 minutes. ` +
    `Delivery estimate: **${company.delivery.estimatedTime}**.\n\n` +
    'If your order is late or incorrect, choose **Order Issue / Complaint** from the menu ' +
    `or contact us at **${company.phoneNumber}**.`
  );
}

function getMenuFooter() {
  return '';
}

module.exports = {
  SUPPORT_MENU,
  getMenuWelcomeText,
  cleanBotReply,
  parseMenuChoice,
  isBackToMenuCommand,
  getInfoReply,
  getOrderStatusPrompt,
  getOrderStatusReply,
  getMenuFooter,
};
