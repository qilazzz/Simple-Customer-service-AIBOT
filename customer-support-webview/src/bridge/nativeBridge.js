/**
 * Native WebView bridge — receive auth/session from React Native host app.
 *
 * React Native example:
 *   webView.postMessage(JSON.stringify({ type: 'AUTH_SESSION', token, user }));
 */

import { setCustomerSession, clearCustomerSession } from '../auth/customerAuth.js';

const handlers = new Set();

function dispatchBridgeEvent(detail) {
  handlers.forEach((handler) => {
    try {
      handler(detail);
    } catch {
      // Ignore handler failures.
    }
  });
}

function handleBridgePayload(raw) {
  let payload = raw;
  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
  }

  if (!payload || typeof payload !== 'object') return;

  switch (payload.type) {
    case 'AUTH_SESSION':
      if (payload.token) {
        setCustomerSession(payload.token, payload.user || null);
        dispatchBridgeEvent({ type: 'auth', user: payload.user || null });
      }
      break;
    case 'CLEAR_SESSION':
      clearCustomerSession();
      dispatchBridgeEvent({ type: 'logout' });
      break;
    case 'SET_API_BASE':
      if (payload.apiBase) {
        window.__US_PIZZA_API_BASE__ = payload.apiBase;
        sessionStorage.setItem('us_pizza_api_base', payload.apiBase.replace(/\/$/, ''));
        dispatchBridgeEvent({ type: 'apiBase', apiBase: payload.apiBase });
      }
      break;
    default:
      dispatchBridgeEvent({ type: 'message', payload });
  }
}

export function initNativeBridge() {
  window.addEventListener('message', (event) => {
    handleBridgePayload(event.data);
  });

  document.addEventListener('message', (event) => {
    handleBridgePayload(event.data);
  });

  if (window.ReactNativeWebView?.postMessage) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'WEBVIEW_READY' }));
  }
}

export function onNativeBridgeEvent(handler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}
