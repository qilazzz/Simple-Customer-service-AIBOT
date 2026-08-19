/**
 * US Pizza Customer Support API client for React Native.
 */
export class CustomerSupportApi {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.sessionId = null;
    this.getAuthHeaders = options.getAuthHeaders || (() => ({}));
  }

  buildHeaders(extra = {}) {
    return {
      ...this.getAuthHeaders(),
      ...extra,
    };
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
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

  /** @deprecated Use startBotSession or startLiveSession */
  async startSession(options = {}) {
    if (options.direct_support === true) {
      return this.startLiveSession();
    }
    return this.startBotSession();
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

  async submitComplaint(photos = [], userId = null) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const formData = new FormData();
    formData.append('sessionId', this.sessionId);
    if (userId) formData.append('user_id', userId);

    photos.forEach((photo, index) => {
      formData.append('photos', {
        uri: photo.uri,
        type: photo.type || 'image/jpeg',
        name: photo.fileName || `photo-${index + 1}.jpg`,
      });
    });

    const data = await this.request('/api/chat/submit', {
      method: 'POST',
      body: formData,
    });

    this.sessionId = null;
    return data;
  }
}
