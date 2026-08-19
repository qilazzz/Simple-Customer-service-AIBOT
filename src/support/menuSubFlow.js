const company = require('../companyKnowledge');

/** @type {{ id: string, emoji: string, label: string }[]} */
const MENU_SUB_OPTIONS = [
  { id: 'browse_pizzas', emoji: '🍕', label: 'Browse Pizzas' },
  { id: 'sides_drinks', emoji: '🍗', label: 'Sides & Drinks' },
  { id: 'sizes_crust', emoji: '📏', label: 'Pizza Sizes & Crust Types' },
  { id: 'full_menu', emoji: '📜', label: 'View Full Menu (PDF/Link)' },
  { id: 'halal_dietary', emoji: '📄', label: 'Halal & Dietary Info' },
];

const BACK_TO_MAIN_MENU = {
  id: 'back_main',
  emoji: '↩️',
  label: 'Back to Main Menu',
};

function getMenuSubPrompt() {
  return 'What would you like to explore in our menu today?';
}

function getMenuSubMenuOptions(includeBack = true) {
  return includeBack ? [...MENU_SUB_OPTIONS, BACK_TO_MAIN_MENU] : [...MENU_SUB_OPTIONS];
}

/**
 * @param {string} text
 * @returns {string|null} sub-menu item id or 'back_main'
 */
function parseMenuSubChoice(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  if (
    lower === BACK_TO_MAIN_MENU.label.toLowerCase() ||
    lower.includes('back to main menu') ||
    (lower.includes('main menu') && lower.includes('back'))
  ) {
    return 'back_main';
  }

  const num = parseInt(trimmed, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= MENU_SUB_OPTIONS.length) {
    return MENU_SUB_OPTIONS[num - 1].id;
  }

  for (const item of MENU_SUB_OPTIONS) {
    const labelLower = item.label.toLowerCase();
    if (lower === labelLower || lower.includes(labelLower)) {
      return item.id;
    }
  }

  if (/\bbrowse\b|\btraditional\b|\bsignature\b|\bchef/.test(lower)) return 'browse_pizzas';
  if (/\bsides?\b|\bdrinks?\b|\bappetizer\b|\bpasta\b|\bbeverage/.test(lower)) {
    return 'sides_drinks';
  }
  if (/\bsize\b|\bcrust\b|\b6"|9"|13"/.test(lower)) return 'sizes_crust';
  if (/\bfull menu\b|\bpdf\b|\blink\b|\bonline menu\b/.test(lower)) return 'full_menu';
  if (/\bhalal\b|\bdietary\b|\bvegetarian\b|\bcertif/.test(lower)) return 'halal_dietary';

  return null;
}

function bulletList(items) {
  return items.map((item) => `• ${item}`).join('\n');
}

/**
 * @param {string} subId
 */
function getMenuSubReply(subId) {
  const menu = company.menu;

  switch (subId) {
    case 'browse_pizzas':
      return (
        '**Browse Pizzas**\n\n' +
        '**Traditional Favourites**\n' +
        `${bulletList(menu.pizzas.traditional)}\n\n` +
        '**Signature Pizzas**\n' +
        `${bulletList(menu.pizzas.signature)}\n\n` +
        '**Chef\'s Best**\n' +
        `${bulletList(menu.pizzas.chefsBest)}\n\n` +
        `Order by phone: **${company.phoneNumber}**`
      );

    case 'sides_drinks':
      return (
        '**Sides & Drinks**\n\n' +
        '**Appetizers & Sides**\n' +
        `${bulletList(menu.sides)}\n\n` +
        '**Pasta**\n' +
        `${bulletList(menu.pasta)}\n\n` +
        '**Beverages**\n' +
        `${bulletList(menu.drinks)}\n\n` +
        'Perfect add-ons to complete your pizza meal!'
      );

    case 'sizes_crust':
      return (
        '**Pizza Sizes & Crust Types**\n\n' +
        '**Sizes**\n' +
        `${menu.sizes.map((item) => `• **${item.name}** (${item.size}) — ${item.serves}`).join('\n')}\n\n` +
        '**Crust Options**\n' +
        `${bulletList(menu.crusts)}\n\n` +
        'Size and crust availability may vary by outlet. Call ahead to confirm.'
      );

    case 'full_menu':
      return (
        '**View Full Menu**\n\n' +
        'Browse our complete menu with photos, prices, and seasonal specials:\n\n' +
        `• **Online menu:** ${menu.fullMenuUrl}\n\n` +
        'Open the link above in your browser, or ask our team for a PDF copy at your nearest outlet.\n\n' +
        `Need help ordering? Call **${company.phoneNumber}**.`
      );

    case 'halal_dietary':
      return (
        '**Halal & Dietary Info**\n\n' +
        '**Halal Certification**\n' +
        `• ${menu.halal.summary}\n` +
        `• ${menu.halal.certificateNote}\n\n` +
        '**Vegetarian Options**\n' +
        `${bulletList(menu.dietary.vegetarian)}\n\n` +
        '**Good to Know**\n' +
        `${bulletList(menu.dietary.notes)}`
      );

    default:
      return getMenuSubPrompt();
  }
}

module.exports = {
  MENU_SUB_OPTIONS,
  BACK_TO_MAIN_MENU,
  getMenuSubPrompt,
  getMenuSubMenuOptions,
  parseMenuSubChoice,
  getMenuSubReply,
};
