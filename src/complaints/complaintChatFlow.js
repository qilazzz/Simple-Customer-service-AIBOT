/**
 * Step-by-step complaint conversation flow for US Pizza Malaysia.
 * Guest: contact → outlet → order_id → description → optional photo → submit.
 * Signed-in: outlet → order_id → description → optional photo → submit.
 */

/** @typedef {'contact'|'outlet'|'order_id'|'description'|'photo'|'ready'} ComplaintStage */

/**
 * @param {Object} collected
 */
function hasGuestContactComplete(collected) {
  return Boolean(
    collected.customer_name?.trim() &&
      collected.customer_email?.trim() &&
      collected.customer_phone?.trim(),
  );
}

/**
 * @param {Object} collected
 * @param {Object} session
 */
function needsGuestContact(collected, session) {
  if (session?.userId) return false;
  if (session?.isGuest === false) return false;
  if (session?.isGuest !== true) return false;
  return !hasGuestContactComplete(collected);
}

/**
 * @param {Object} collected
 * @returns {'name'|'email'|'phone'|'done'}
 */
function getContactStep(collected) {
  if (!collected.customer_name?.trim()) return 'name';
  if (!collected.customer_email?.trim()) return 'email';
  if (!collected.customer_phone?.trim()) return 'phone';
  return 'done';
}

/**
 * @param {string} text
 */
function validateEmail(text) {
  const trimmed = text.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/**
 * @param {string} text
 */
function validatePhone(text) {
  const digits = text.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return null;
  return text.trim();
}

/**
 * @param {string} text
 */
function validateName(text) {
  const trimmed = text.trim();
  return trimmed.length >= 2 ? trimmed : null;
}

/**
 * @param {Object} collected
 * @param {{ name?: string, email?: string, phone?: string }} details
 * @returns {{ collected: Object, errors: string[] }}
 */
function applyGuestDetails(collected, details) {
  const next = { ...collected };
  const errors = [];

  const name = validateName(details.name || '');
  const email = validateEmail(details.email || '');
  const phone = validatePhone(details.phone || '');

  if (!name) errors.push('Please enter your full name (at least 2 characters).');
  if (!email) errors.push('Please enter a valid email address.');
  if (!phone) errors.push('Please enter a valid phone number (e.g. 0123456789).');

  if (!errors.length) {
    next.customer_name = name;
    next.customer_email = email;
    next.customer_phone = phone;
    next.customer_contact = email;
  }

  return { collected: next, errors };
}

/**
 * @param {Object} collected
 * @param {string} userMessage
 * @returns {{ collected: Object, error: string|null, done: boolean, contact_step: string }}
 */
function processContactInput(collected, userMessage) {
  const next = { ...collected };
  const step = getContactStep(collected);
  const trimmed = userMessage.trim();
  let error = null;

  if (step === 'name') {
    const name = validateName(trimmed);
    if (!name) error = 'Please enter your full name (at least 2 characters).';
    else next.customer_name = name;
  } else if (step === 'email') {
    const email = validateEmail(trimmed);
    if (!email) error = 'Please enter a valid email address (e.g. you@email.com).';
    else {
      next.customer_email = email;
      next.customer_contact = email;
    }
  } else if (step === 'phone') {
    const phone = validatePhone(trimmed);
    if (!phone) error = 'Please enter a valid phone number (e.g. 0123456789).';
    else next.customer_phone = phone;
  }

  const contactStep = getContactStep(next);
  return {
    collected: next,
    error,
    done: contactStep === 'done',
    contact_step: contactStep,
  };
}

/**
 * @param {string} text
 */
function validateOrderId(text) {
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return null;
  if (!/^[A-Za-z0-9#\-_/ ]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * @param {Object} collected
 * @param {Object} session
 * @returns {ComplaintStage}
 */
function getCurrentStage(collected, session) {
  if (needsGuestContact(collected, session)) return 'contact';
  if (!collected.outlet_name) return 'outlet';
  if (!collected.order_id) return 'order_id';
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
 * @param {'name'|'email'|'phone'|'done'} [contactStep]
 */
function getStageReply(stage, collected = {}, contactStep = getContactStep(collected)) {
  switch (stage) {
    case 'contact':
      if (contactStep === 'name') {
        return (
          'Before we log your complaint, please share your contact details so our team can follow up.\n\n' +
          'What is your **full name**?'
        );
      }
      if (contactStep === 'email') {
        return `Thank you, **${collected.customer_name}**. What is your **email address**?`;
      }
      if (contactStep === 'phone') {
        return 'Got it. Lastly, what is your **phone number**? (e.g. 0123456789)';
      }
      return 'Thank you. Now let\'s continue with your complaint.';
    case 'outlet':
      return (
        "I'm really sorry to hear you've had a frustrating experience with US Pizza Malaysia. " +
        'Which US Pizza outlet did you order from or visit? Tap an outlet below or type to search.'
      );
    case 'order_id':
      return (
        `Thank you. I've noted **${collected.outlet_name || 'your outlet'}**. ` +
        'Please share your **Order ID** or receipt number so we can look into this.'
      );
    case 'description':
      return (
        `Thank you. I've noted order **${collected.order_id || 'ID'}**. ` +
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
  needsGuestContact,
  hasGuestContactComplete,
  getContactStep,
  applyGuestDetails,
  processContactInput,
  validateEmail,
  validatePhone,
  validateName,
  validateOrderId,
};
