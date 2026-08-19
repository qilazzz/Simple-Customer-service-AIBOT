/**
 * US Pizza Customer Support — API client for web & mobile apps.
 * Usage: const client = new CustomerSupportClient({ baseUrl: 'https://api.example.com' });
 */
class CustomerSupportClient {
  constructor({ baseUrl = '' } = {}) {
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
    return {
      sessionId: data.sessionId,
      reply: data.reply,
      stage: data.stage,
    };
  }

  async sendMessage(message) {
    if (!this.sessionId) throw new Error('No active session. Call startSession() first.');

    const data = await this.request('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: this.sessionId, message }),
    });

    return {
      reply: data.reply,
      stage: data.stage,
      readyToSubmit: data.ready_to_submit,
      collected: data.collected,
    };
  }

  async submitComplaint(photos = []) {
    if (!this.sessionId) throw new Error('No active session. Call startSession() first.');

    const formData = new FormData();
    formData.append('sessionId', this.sessionId);
    photos.forEach((file) => formData.append('photos', file));

    const data = await this.request('/api/chat/submit', {
      method: 'POST',
      body: formData,
    });

    this.sessionId = null;
    return {
      ticketId: data.ticket_id,
      reply: data.reply,
      complaint: data.complaint,
    };
  }

  async healthCheck() {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CustomerSupportClient };
}

if (typeof window !== 'undefined') {
  window.CustomerSupportClient = CustomerSupportClient;
}
