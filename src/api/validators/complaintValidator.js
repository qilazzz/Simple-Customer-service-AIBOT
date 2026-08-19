const VALID_CATEGORIES = [
  'wrong_order',
  'late_delivery',
  'food_quality',
  'service',
  'other',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function validateComplaintPayload(body = {}) {
  const errors = [];

  const customer_name = trimOrNull(body.customer_name);
  const customer_email = trimOrNull(body.customer_email);
  const message = trimOrNull(body.message);
  const order_id = trimOrNull(body.order_id);
  const customer_phone = trimOrNull(body.customer_phone);
  const complaint_category = trimOrNull(body.complaint_category) || 'other';

  if (!customer_name) {
    errors.push('customer_name is required');
  } else if (customer_name.length > 150) {
    errors.push('customer_name must be 150 characters or fewer');
  }

  if (!customer_email) {
    errors.push('customer_email is required');
  } else if (!EMAIL_REGEX.test(customer_email)) {
    errors.push('customer_email must be a valid email address');
  } else if (customer_email.length > 150) {
    errors.push('customer_email must be 150 characters or fewer');
  }

  if (!message) {
    errors.push('message is required');
  }

  if (customer_phone && customer_phone.length > 50) {
    errors.push('customer_phone must be 50 characters or fewer');
  }

  if (order_id && order_id.length > 100) {
    errors.push('order_id must be 100 characters or fewer');
  }

  if (!VALID_CATEGORIES.includes(complaint_category)) {
    errors.push(`complaint_category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  if (errors.length) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      order_id,
      customer_name,
      customer_email,
      customer_phone,
      complaint_category,
      message,
      status: 'pending',
    },
  };
}

module.exports = { validateComplaintPayload, VALID_CATEGORIES };
