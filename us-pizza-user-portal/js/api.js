import { buildApiUrl } from './config.js';
import { customerAuthHeaders, getCustomerUserId } from './auth.js';

export class CustomerSupportApi {
  constructor(options = {}) {
    this.sessionId = null;
    this.getAuthHeaders = options.getAuthHeaders || customerAuthHeaders;
  }

  buildHeaders(extra = {}) {
    return { ...this.getAuthHeaders(), ...extra };
  }

  async request(path, options = {}) {
    const res = await fetch(buildApiUrl(path), {
      ...options,
      headers: this.buildHeaders(options.headers || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      const detail = data.errors?.length ? data.errors.join(' ') : data.message;
      throw new Error(detail || `Request failed (${res.status})`);
    }
    return data;
  }

  async getLiveChatHistory() {
    return this.request('/api/chat/history?direct_support=true');
  }

  async startBotSession() {
    const body = { direct_support: false };
    const userId = getCustomerUserId();
    if (userId && userId !== 'guest') body.user_id = userId;

    const data = await this.request('/api/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    this.sessionId = data.sessionId;
    return data;
  }

  async startLiveSession() {
    const body = { direct_support: true };
    const userId = getCustomerUserId();
    if (userId && userId !== 'guest') body.user_id = userId;

    const data = await this.request('/api/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    this.sessionId = data.sessionId;
    return data;
  }

  async sendMessage(message, userId = null) {
    if (!this.sessionId) throw new Error('No active session');

    const body = { sessionId: this.sessionId, message };
    if (userId) body.user_id = userId;

    return this.request('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async submitGuestDetails({ name, email, phone }) {
    if (!this.sessionId) throw new Error('No active session');

    return this.request('/api/chat/guest-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        name,
        email,
        phone,
      }),
    });
  }

  async getLiveUpdates(sinceId = 0) {
    if (!this.sessionId) throw new Error('No active session');

    const params = new URLSearchParams({
      sessionId: this.sessionId,
      sinceId: String(sinceId || 0),
    });
    return this.request(`/api/chat/live-updates?${params}`);
  }

  getSessionId() {
    return this.sessionId;
  }

  setSessionId(id) {
    this.sessionId = id;
  }

  async submitComplaint(photos = [], userId = null) {
    if (!this.sessionId) throw new Error('No active session');

    const formData = new FormData();
    formData.append('sessionId', this.sessionId);
    if (userId) formData.append('user_id', userId);
    photos.forEach((file, index) => {
      formData.append('photos', file, file.name || `photo-${index + 1}.jpg`);
    });

    const data = await this.request('/api/chat/submit', { method: 'POST', body: formData });
    this.sessionId = null;
    return data;
  }

  async submitComplaintForm(payload, photos = []) {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, value);
      }
    });
    photos.forEach((file, index) => {
      formData.append('photos', file, file.name || `photo-${index + 1}.jpg`);
    });

    return this.request('/api/complaints', { method: 'POST', body: formData });
  }
}
