# US Pizza Customer Support — WebView App

Standalone customer-facing web app designed for **native WebView embedding** or mobile browser. It shares the same backend API and database as the Admin Portal (`customer-service` root project).

## Quick start

1. Start the shared API server from the parent repo:

```bash
cd ../
npm install
npm start
```

2. Serve this WebView app:

```bash
cd customer-support-webview
npm start
```

3. Open `http://localhost:5173/?apiBase=http://localhost:3000`

## WebView URL parameters

Pass auth and API config when opening the WebView:

```
https://your-webview-host/?apiBase=https://api.example.com&token=XYZ&user_id=123
```

| Parameter | Description |
|-----------|-------------|
| `apiBase` | Shared backend root URL (default: same origin or `http://localhost:3000`) |
| `token` | Customer Bearer token |
| `user_id` | Customer user id (stored with session) |
| `guest` | `1` to skip auth requirement for live chat |

Tokens are persisted in `localStorage` and attached to all API requests.

## Native app bridge

React Native WebView can inject credentials after load:

```javascript
webViewRef.postMessage(JSON.stringify({
  type: 'AUTH_SESSION',
  token: '...',
  user: { user_id: '123', name: 'Jane', email: 'j@example.com' },
}));
```

## Project structure

```
customer-support-webview/
├── index.html              # Support menu (mobile layout)
├── pages/
│   ├── live-chat.html      # Live agent chat
│   └── bot-chat.html       # Bot / complaint flow
├── src/
│   ├── config.js           # API_BASE_URL resolution
│   ├── auth/customerAuth.js
│   ├── api/customerSupportApi.js
│   ├── bridge/nativeBridge.js
│   └── chat/liveChatListener.js
└── styles/
    ├── tokens.css
    └── app.css
```

## Backend endpoints used

Same as the React Native app — all routes on the shared `customer-service` server:

- `POST /api/auth/login`, `/register`, `GET /api/auth/session-check`
- `POST /api/chat/session`, `/message`, `/submit`
- `GET /api/chat/history`, `/live-updates`
- `GET /api/outlets`, `/api/outlets/states`

## Real-time updates

The shared backend currently delivers live chat updates via **HTTP polling** (`GET /api/chat/live-updates`). `LiveChatListener` wraps this and exposes a WebSocket-style event API. When a WebSocket endpoint is added server-side, swap the transport in `liveChatListener.js` without changing page code.
