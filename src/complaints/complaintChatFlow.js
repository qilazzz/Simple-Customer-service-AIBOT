/**
 * Step-by-step complaint conversation flow for US Pizza Malaysia.
 * Simplified: outlet → description → optional photo → submit.
 */

/** @typedef {'outlet'|'description'|'photo'|'ready'} ComplaintStage */

/**
 * @param {Object} collected
 * @param {Object} session
 * @returns {ComplaintStage}
 */
function getCurrentStage(collected, session) {
  if (!collected.outlet_name) return 'outlet';
  if (!collected.description) return 'description';
  if (!session.photoPromptShown) return 'photo';
  return 'ready';
}

/**
 * @param {string} text
 * @param {Array<{outlet_id: string, outlet_name: string, state?: string, city?: string}>} outlets
 */
function parseOutletChoice(text, outlets = []) {
  const trimmed = text.trim();
  if (!trimmed || !outlets.length) return null;

  const lower = trimmed.toLowerCase();

  const exact = outlets.find((outlet) => outlet.outlet_name.toLowerCase() === lower);
  if (exact) return exact;

  const partialMatches = outlets.filter(
    (outlet) =>
      outlet.outlet_name.toLowerCase().includes(lower) ||
      lower.includes(outlet.outlet_name.toLowerCase()),
  );
  if (partialMatches.length === 1) return partialMatches[0];

  return null;
}

/**
 * @param {Array<{outlet_id: string, outlet_name: string, state?: string, city?: string}>} outlets
 */
function formatOutletOptions(outlets) {
  return outlets.map((outlet) => ({
    id: outlet.outlet_id,
    outlet_id: outlet.outlet_id,
    label: outlet.outlet_name,
    name: outlet.outlet_name,
    state: outlet.state || null,
    city: outlet.city || null,
  }));
}

/**
 * @param {ComplaintStage} stage
 * @param {Object} [collected]
 */
function getStageReply(stage, collected = {}) {
  switch (stage) {
    case 'outlet':
      return (
        "I'm really sorry to hear you've had a frustrating experience with US Pizza Malaysia. " +
        'Which US Pizza outlet did you order from or visit? Tap an outlet below or type to search.'
      );
    case 'description':
      return (
        `Thank you. I've noted **${collected.outlet_name || 'your outlet'}**. ` +
        "Could you briefly tell me what went wrong with your order or visit?"
      );
    case 'photo':
      return (
        'Thank you for sharing those details. If you have a photo as proof, you can upload it below — this is optional. ' +
        "When you're ready, tap **Submit Complaint**, or reply **skip** if you don't have a photo."
      );
    case 'ready':
      return (
        'Thank you for sharing all the details. Please tap **Submit Complaint** to log your ticket with our management team.'
      );
    default:
      return 'How can I help you with your complaint today?';
  }
}

/**
 * @param {string} text
 */
function isPhotoSkip(text) {
  return /\b(skip|no photo|don't have|dont have|no picture|none|not now|no thanks)\b/i.test(text);
}

function isSubmitCommand(text) {
  return /\b(submit|done|confirm|send complaint|log it|log complaint)\b/i.test(text);
}

function isCancelCommand(text) {
  return /\b(cancel|stop|exit|nevermind|never mind|quit)\b/i.test(text);
}

function isComplaintTrigger(text) {
  return /\b(complaint|complain|report( a)? problem|file a report|log a complaint|make a complaint|not happy|unhappy|dissatisfied|bad experience|poor service)\b/i.test(
    text,
  );
}

/**
 * Build wrap-up message after ticket is created.
 * @param {number|string} ticketId
 */
function buildTicketConfirmation(ticketId) {
  return (
    `Thank you for your patience, and I'm truly sorry for the inconvenience you've experienced. ` +
    `Your complaint ticket #${ticketId} has been logged and sent directly to our human management team. ` +
    'An admin will review it shortly and follow up with you. We appreciate you giving us the chance to make this right.'
  );
}

module.exports = {
  getCurrentStage,
  getStageReply,
  parseOutletChoice,
  formatOutletOptions,
  isPhotoSkip,
  isSubmitCommand,
  isCancelCommand,
  isComplaintTrigger,
  buildTicketConfirmation,
};
