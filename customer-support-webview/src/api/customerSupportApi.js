/**
 * Customer Support API client — same contract as mobile/us-pizza-app.
 */

import { buildApiUrl } from '../config.js';
import { customerAuthHeaders } from '../auth/customerAuth.js';

export class CustomerSupportApi {
  constructor(options = {}) {
    this.sessionId = null;
    this.getAuthHeaders = options.getAuthHeaders || customerAuthHeaders;
  }

  buildHeaders(extra = {}) {
    return {
      ...this.getAuthHeaders(),
      ...extra,
    };
  }

  async request(path, options = {}) {
    const url = buildApiUrl(path);
    const res = await fetch(url, {
      ...options,
      headers: this.buildHeaders(options.headers || {}),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
  }

  async getLiveChatHistory() {
    return this.request('/api/chat/history?direct_support=true');
  }

  async startBotSession() {
    const data = await this.request('/api/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direct_support: false }),
    });
    this.sessionId = data.sessionId;
    return data;
  }

  async startLiveSession() {
    const data = await this.request('/api/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direct_support: true }),
    });
    this.sessionId = data.sessionId;
    return data;
  }

  async sendMessage(message, userId = null) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const body = { sessionId: this.sessionId, message };
    if (userId) body.user_id = userId;

    return this.request('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async getLiveUpdates(sinceId = 0) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const params = new URLSearchParams({
      sessionId: this.sessionId,
      sinceId: String(sinceId || 0),
    });

    return this.request(`/api/chat/live-updates?${params}`);
  }

  getSessionId() {
    return this.sessionId;
  }

  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  async submitComplaint(photos = [], userId = null) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const formData = new FormData();
    formData.append('sessionId', this.sessionId);
    if (userId) formData.append('user_id', userId);

    photos.forEach((file, index) => {
      formData.append('photos', file, file.name || `photo-${index + 1}.jpg`);
    });

    const data = await this.request('/api/chat/submit', {
      method: 'POST',
      body: formData,
    });

    this.sessionId = null;
    return data;
  }
}
