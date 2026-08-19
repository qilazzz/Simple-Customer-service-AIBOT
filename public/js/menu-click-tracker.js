/**
 * Fire-and-forget analytics for chatbot quick-reply menu clicks.
 */
(function initMenuClickTracker(global) {
  const STORAGE_KEY = 'uspizza_analytics_uid';

  function getAnonymousUserId() {
    try {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch {
      return null;
    }
  }

  /**
   * @param {string} buttonName — e.g. "Menu", "Find an Outlet"
   * @param {{ userId?: string|null, apiBase?: string }} [options]
   */
  function trackMenuButtonClick(buttonName, options = {}) {
    if (!buttonName?.trim()) return;

    const base = (options.apiBase || global.location?.origin || '').replace(/\/$/, '');
    let userId = options.userId || null;

    if (!userId) {
      try {
        const raw = localStorage.getItem('customer_user');
        const user = raw ? JSON.parse(raw) : null;
        userId = user?.user_id || localStorage.getItem('uspizza_analytics_uid') || getAnonymousUserId();
      } catch {
        userId = getAnonymousUserId();
      }
    }

    fetch(`${base}/api/analytics/track-click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        button_name: buttonName.trim(),
        user_id: userId,
      }),
      keepalive: true,
    }).catch(() => {});
  }

  global.trackMenuButtonClick = trackMenuButtonClick;
})(typeof window !== 'undefined' ? window : global);
