# US Pizza User Portal

Standalone customer web app that mirrors the **React Native mobile app** UI and uses the **same shared backend** as the Admin Portal.

## Features (matches mobile app)

- **In-app login & register** — same forms as mobile (no external `login.html` / `register.html`)
- **Find Outlets** — search, state chips, outlet cards with Call / Directions
- **Support menu** — 6 option cards (Find Outlet, Order Status, Complaint, Menu, Promotions, Talk to Support)
- **Bot chat** — complaint flow with quick option chips, outlet picker, photo upload, Submit ticket
- **Live chat** — inline status bar, guest/signed-in bar, support bubbles, stacked compose (matches mobile)
- **Draggable FAB** — inside the phone frame on Home only (snap-to-edge, same as mobile)
- **Auth** — in-app login/register, `?token=&user_id=` via WebView URL or `localStorage`

All data flows through the shared API (`/api/chat/*`) into the same database tables the admin dashboard reads.

## Run

```bash
# Terminal 1 — shared API (parent repo)
cd ..
npm start

# Terminal 2 — user portal
npm start
```

Open: `http://localhost:5180/?apiBase=http://localhost:3000`

## WebView example

```
https://your-portal.example/?apiBase=https://api.example.com&token=XYZ&user_id=123
```

Native apps can inject auth after load:

```javascript
webView.postMessage(JSON.stringify({ type: 'AUTH_SESSION', token, user }));
```

## Project structure

```
us-pizza-user-portal/
├── index.html
├── styles.css
├── assets/customer-service-icon.png
└── js/
    ├── app.js              # Router + navigation
    ├── config.js           # API_BASE_URL, SUPPORT_MENU
    ├── auth.js             # Token / user_id handling
    ├── api.js              # CustomerSupportApi (same as mobile)
    ├── auth-api.js         # login / register / logout / outlets
    ├── floating-button.js  # Draggable FAB (inside frame)
    └── views/
        ├── home.js
        ├── menu.js
        ├── auth.js
        ├── outlets.js
        ├── bot-chat.js
        └── live-chat.js
```
