/**
 * US Pizza Customer Support API client for React Native.
 */
export class CustomerSupportApi {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.sessionId = null;
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.success === false) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }

    return data;
  }

  async startSession() {
    const data = await this.request('/api/chat/session', { method: 'POST' });
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

  /**
   * @param {Array<{ uri: string, type?: string, fileName?: string }>} photos
   */
  async submitComplaint(photos = []) {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const formData = new FormData();
    formData.append('sessionId', this.sessionId);

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

  async healthCheck() {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json();
  }
}
