/**
 * @typedef {'wrong_order'|'late_delivery'|'food_quality'|'service'|'other'} ComplaintCategory
 * @typedef {'pending'|'in_progress'|'resolved'} ComplaintStatus
 * @typedef {'Low'|'Medium'|'High'} ComplaintPriority
 * @typedef {'customer'|'ai'|'admin'} MessageSender
 */

/** @type {Record<ComplaintCategory, string>} */
const CATEGORY_LABELS = {
  wrong_order: 'Wrong Order',
  late_delivery: 'Late Delivery',
  food_quality: 'Food Quality',
  service: 'Service',
  other: 'Other',
};

/** @type {ComplaintCategory[]} */
const VALID_CATEGORIES = Object.keys(CATEGORY_LABELS);

/** Numbered menu for chat / app category selection */
const CATEGORY_MENU = VALID_CATEGORIES.map((key, index) => ({
  number: index + 1,
  key,
  label: CATEGORY_LABELS[key],
}));

/** @type {ComplaintStatus[]} */
const VALID_STATUSES = ['pending', 'in_progress', 'resolved'];

/** @type {ComplaintPriority[]} */
const VALID_PRIORITIES = ['Low', 'Medium', 'High'];

/** @type {Record<ComplaintStatus, string>} */
const STATUS_LABELS = {
  pending: 'Pending',
  in_progress: 'In Progress',
  in_review: 'In Progress',
  resolved: 'Resolved',
};

/** @type {Record<ComplaintPriority, string>} */
const PRIORITY_LABELS = {
  Low: 'Low',
  Medium: 'Medium',
  High: 'High',
};

/** @type {('positive'|'neutral'|'frustrated'|'urgent')[]} */
const VALID_SENTIMENTS = ['positive', 'neutral', 'frustrated', 'urgent'];

/** @type {Record<string, string>} */
const SENTIMENT_LABELS = {
  positive: 'Positive',
  neutral: 'Neutral',
  frustrated: 'Frustrated',
  urgent: 'Urgent',
};

module.exports = {
  CATEGORY_LABELS,
  CATEGORY_MENU,
  VALID_CATEGORIES,
  VALID_STATUSES,
  VALID_PRIORITIES,
  VALID_SENTIMENTS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  SENTIMENT_LABELS,
};
