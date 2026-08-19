import { API_BASE_URL } from '../support/config';

export class OutletsApi {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async request(path) {
    const res = await fetch(`${this.baseUrl}${path}`);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.success === false) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }

    return data;
  }

  listOutlets({ state, search } = {}) {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (search) params.set('search', search);
    const query = params.toString();
    return this.request(`/api/outlets${query ? `?${query}` : ''}`);
  }

  listStates() {
    return this.request('/api/outlets/states');
  }

  getOutlet(outletId) {
    return this.request(`/api/outlets/${encodeURIComponent(outletId)}`);
  }
}
