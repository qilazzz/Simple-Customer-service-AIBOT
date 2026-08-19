const db = require('../db/knex');
const { SUPPORT_MENU } = require('../support/supportMenu');

const VALID_BUTTON_NAMES = SUPPORT_MENU.map((item) => item.label);

const BUTTON_META = Object.fromEntries(
  SUPPORT_MENU.map((item) => [item.label, { emoji: item.emoji, id: item.id }]),
);

/**
 * @param {string} buttonName
 */
function isValidButtonName(buttonName) {
  return VALID_BUTTON_NAMES.includes(buttonName);
}

/**
 * @param {{ button_name: string, user_id?: string|null }} data
 */
async function trackButtonClick(data) {
  const buttonName = String(data.button_name || '').trim();
  if (!isValidButtonName(buttonName)) {
    const error = new Error(`button_name must be one of: ${VALID_BUTTON_NAMES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const userId = data.user_id ? String(data.user_id).trim().slice(0, 100) : null;

  const [id] = await db('button_clicks').insert({
    button_name: buttonName,
    user_id: userId || null,
  });

  return { id, button_name: buttonName, user_id: userId };
}

async function getButtonClickStats() {
  const rows = await db('button_clicks')
    .select('button_name')
    .count('* as count')
    .groupBy('button_name');

  const countByName = rows.reduce((acc, row) => {
    acc[row.button_name] = Number(row.count) || 0;
    return acc;
  }, {});

  const totalClicks = VALID_BUTTON_NAMES.reduce(
    (sum, name) => sum + (countByName[name] || 0),
    0,
  );

  const buttons = VALID_BUTTON_NAMES.map((buttonName) => {
    const count = countByName[buttonName] || 0;
    const meta = BUTTON_META[buttonName] || {};
    return {
      button_name: buttonName,
      emoji: meta.emoji || '',
      id: meta.id || null,
      count,
      percentage: totalClicks ? Math.round((count / totalClicks) * 1000) / 10 : 0,
    };
  });

  return {
    total_clicks: totalClicks,
    buttons,
  };
}

/**
 * @param {string} buttonName
 */
async function getButtonClickDetails(buttonName) {
  const trimmed = String(buttonName || '').trim();
  if (!isValidButtonName(trimmed)) {
    const error = new Error(`button_name must be one of: ${VALID_BUTTON_NAMES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  const hasProfile = await db.schema.hasTable('profile');

  let query = db('button_clicks as bc').where('bc.button_name', trimmed);

  if (hasProfile) {
    query = query
      .leftJoin('profile as p', 'bc.user_id', 'p.user_id')
      .select(
        'bc.id',
        'bc.button_name',
        'bc.created_at',
        db.raw("COALESCE(p.name, 'Guest / Unregistered User') as customer_name"),
        db.raw("COALESCE(p.email, p.phone_number, '-') as contact_info"),
      );
  } else {
    query = query.select(
      'bc.id',
      'bc.button_name',
      'bc.created_at',
      db.raw("'Guest / Unregistered User' as customer_name"),
      db.raw("'-' as contact_info"),
    );
  }

  const rows = await query.orderBy('bc.created_at', 'desc');

  return rows.map((row) => ({
    id: row.id,
    button_name: row.button_name,
    customer_name: row.customer_name,
    contact_info: row.contact_info,
    created_at: row.created_at,
  }));
}

module.exports = {
  VALID_BUTTON_NAMES,
  isValidButtonName,
  trackButtonClick,
  getButtonClickStats,
  getButtonClickDetails,
};
