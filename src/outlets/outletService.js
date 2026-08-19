const db = require('../db/knex');

function formatOutlet(row) {
  return {
    id: row.outlet_id,
    outlet_id: row.outlet_id,
    name: row.outlet_name,
    outlet_name: row.outlet_name,
    address: row.address,
    state: row.state,
    city: row.city,
    phone: row.phone,
    opening_hours: row.opening_hours,
    location_url: row.location_url,
  };
}

/**
 * @param {Object} [filters]
 * @param {string} [filters.state]
 * @param {string} [filters.city]
 * @param {string} [filters.search]
 * @param {number} [filters.limit]
 */
async function listOutlets(filters = {}) {
  let query = db('us_pizza_outlets').orderBy(['state', 'city', 'outlet_name']);

  if (filters.state) {
    query = query.whereRaw('LOWER(state) = LOWER(?)', [filters.state.trim()]);
  }

  if (filters.city) {
    query = query.where('city', filters.city);
  }

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    query = query.where(function searchOutlets() {
      this.where('outlet_name', 'like', term)
        .orWhere('address', 'like', term)
        .orWhere('city', 'like', term)
        .orWhere('state', 'like', term)
        .orWhere('outlet_id', 'like', term);
    });
  }

  if (filters.limit) {
    query = query.limit(Number(filters.limit));
  }

  const rows = await query;
  return rows.map(formatOutlet);
}

async function getOutletById(outletId) {
  const row = await db('us_pizza_outlets').where({ outlet_id: outletId }).first();
  return row ? formatOutlet(row) : null;
}

async function listStates() {
  const rows = await db('us_pizza_outlets').distinct('state').orderBy('state', 'asc');
  return rows.map((row) => row.state);
}

async function countOutlets(filters = {}) {
  let query = db('us_pizza_outlets');

  if (filters.state) {
    query = query.whereRaw('LOWER(state) = LOWER(?)', [filters.state.trim()]);
  }

  const [result] = await query.count('* as count');
  return Number(result.count);
}

async function listOutletsForPicker() {
  const rows = await db('us_pizza_outlets')
    .select('outlet_id', 'outlet_name', 'state', 'city')
    .orderBy('outlet_name', 'asc');
  return rows.map(formatOutlet);
}

async function resolveOutletByName(outletName) {
  if (!outletName?.trim()) return null;
  const row = await db('us_pizza_outlets')
    .where('outlet_name', outletName.trim())
    .first();
  return row ? formatOutlet(row) : null;
}

module.exports = {
  listOutlets,
  listOutletsForPicker,
  resolveOutletByName,
  getOutletById,
  listStates,
  countOutlets,
  formatOutlet,
};
