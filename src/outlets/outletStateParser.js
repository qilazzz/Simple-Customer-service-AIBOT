/** Common aliases mapped to canonical DB state names */
const STATE_ALIASES = {
  kl: 'Kuala Lumpur',
  'kuala lumpur': 'Kuala Lumpur',
  'wilayah persekutuan': 'Kuala Lumpur',
  'wp kuala lumpur': 'Kuala Lumpur',
  penang: 'Penang',
  'pulau pinang': 'Penang',
  melaka: 'Melaka',
  malacca: 'Melaka',
  'negeri sembilan': 'Negeri Sembilan',
  terengganu: 'Terengganu',
  kelantan: 'Kelantan',
  kedah: 'Kedah',
  johor: 'Johor',
  selangor: 'Selangor',
  perak: 'Perak',
  pahang: 'Pahang',
  sabah: 'Sabah',
  sarawak: 'Sarawak',
  labuan: 'Labuan',
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesToken(text, token) {
  const pattern = new RegExp(`\\b${escapeRegex(token)}\\b`, 'i');
  return pattern.test(text);
}

/**
 * Extract a Malaysian state name from free-text user input.
 * @param {string} text
 * @param {string[]} [knownStates] Canonical state names from the database
 * @returns {string|null}
 */
function extractStateFromText(text, knownStates = []) {
  const normalized = String(text || '').trim();
  if (!normalized) return null;

  const lower = normalized.toLowerCase();

  const aliasEntries = Object.entries(STATE_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, canonical] of aliasEntries) {
    if (matchesToken(lower, alias)) {
      if (!knownStates.length || knownStates.includes(canonical)) {
        return canonical;
      }
    }
  }

  const sortedStates = [...knownStates].sort((a, b) => b.length - a.length);
  for (const state of sortedStates) {
    if (matchesToken(lower, state)) {
      return state;
    }
  }

  return null;
}

/**
 * Detect when the user tried to specify a location but it did not match a known state.
 * @param {string} text
 * @returns {string|null}
 */
function extractUnmatchedLocationHint(text) {
  const match = String(text || '').match(/\b(?:in|at|near|around|within)\s+([a-z][a-z\s.'-]{1,40})$/i);
  if (!match) return null;

  const hint = match[1].trim();
  if (hint.length < 3) return null;

  return hint.replace(/\s+/g, ' ');
}

module.exports = {
  STATE_ALIASES,
  extractStateFromText,
  extractUnmatchedLocationHint,
};
