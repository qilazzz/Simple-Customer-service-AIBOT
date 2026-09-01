/**
 * Live chat real-time listener.
 *
 * The shared backend currently exposes live updates via HTTP polling
 * (GET /api/chat/live-updates). This class wraps polling with a
 * WebSocket-style subscribe API so pages can swap transports later.
 */

export class LiveChatListener {
  /**
   * @param {import('../api/customerSupportApi.js').CustomerSupportApi} api
   * @param {{ intervalMs?: number, transport?: 'poll' | 'websocket' }} options
   */
  constructor(api, options = {}) {
    this.api = api;
    this.intervalMs = options.intervalMs ?? 1500;
    this.transport = options.transport ?? 'poll';
    this.lastMessageId = 0;
    this.timer = null;
    this.socket = null;
    this.running = false;
    this.onMessage = null;
    this.onError = null;
    this.onStatusChange = null;
  }

  setHandlers({ onMessage, onError, onStatusChange } = {}) {
    if (onMessage) this.onMessage = onMessage;
    if (onError) this.onError = onError;
    if (onStatusChange) this.onStatusChange = onStatusChange;
  }

  async start(sessionId) {
    this.stop();
    this.running = true;
    this.api.setSessionId(sessionId);

    if (this.transport === 'websocket') {
      await this.startWebSocket(sessionId);
      return;
    }

    this.startPolling();
  }

  startPolling() {
    const tick = async () => {
      if (!this.running) return;

      try {
        const data = await this.api.getLiveUpdates(this.lastMessageId);
        const messages = data.messages || [];

        messages.forEach((message) => {
          const id = Number(message.id) || 0;
          if (id > this.lastMessageId) {
            this.lastMessageId = id;
          }
          this.onMessage?.({
            type: 'message',
            message,
            liveAgent: data.live_agent,
            waitingForAgent: data.waiting_for_agent,
            status: data.status,
          });
        });

        if (data.status) {
          this.onStatusChange?.({
            status: data.status,
            liveAgent: data.live_agent,
            waitingForAgent: data.waiting_for_agent,
          });
        }
      } catch (err) {
        this.onError?.(err);
      }
    };

    tick();
    this.timer = window.setInterval(tick, this.intervalMs);
  }

  async startWebSocket(sessionId) {
    const wsBase = (window.__US_PIZZA_WS_BASE__ || '').replace(/\/$/, '');
    if (!wsBase) {
      this.startPolling();
      return;
    }

    const url = `${wsBase}/api/chat/ws?sessionId=${encodeURIComponent(sessionId)}`;

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(url);

        this.socket.addEventListener('open', () => resolve());

        this.socket.addEventListener('message', (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.message) {
              const id = Number(payload.message.id) || 0;
              if (id > this.lastMessageId) this.lastMessageId = id;
              this.onMessage?.(payload);
            }
            if (payload.status) {
              this.onStatusChange?.(payload);
            }
          } catch (err) {
            this.onError?.(err);
          }
        });

        this.socket.addEventListener('error', () => {
          this.socket?.close();
          this.socket = null;
          this.startPolling();
          resolve();
        });

        this.socket.addEventListener('close', () => {
          if (this.running && !this.timer) {
            this.startPolling();
          }
        });
      } catch (err) {
        this.startPolling();
        resolve();
      }
    });
  }

  stop() {
    this.running = false;
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  resetCursor(lastMessageId = 0) {
    this.lastMessageId = Number(lastMessageId) || 0;
  }
}
