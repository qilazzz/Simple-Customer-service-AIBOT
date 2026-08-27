import { buildApiUrl } from './config.js';
import { getCustomerUserId } from './auth.js';

/**
 * Fire-and-forget tracking for chatbot menu button clicks (admin analytics).
 */
export function trackMenuButtonClick(buttonName) {
  if (!buttonName?.trim()) return;

  fetch(buildApiUrl('/api/analytics/track-click'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      button_name: buttonName.trim(),
      user_id: getCustomerUserId(),
    }),
    keepalive: true,
  }).catch(() => {});
}
