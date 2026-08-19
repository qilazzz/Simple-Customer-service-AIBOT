# US Pizza Customer Service

AI-powered customer service API for **US Pizza Malaysia** — complaint chatbot, outlet finder, admin dashboard, web chat, and Expo mobile app.

**Stack:** Node.js · Express · MySQL (Knex) · Google Gemini · React Native (Expo)

---

## Features

- Customer support chat with menu-driven flows (order status, complaints, outlets, etc.)
- Complaint submission with photo uploads and AI analysis
- Outlet finder backed by MySQL (`us_pizza_outlets`)
- Admin dashboard for ticket management
- Web chat widget and mobile app

---

## Requirements

| Requirement | Notes |
|-------------|-------|
| **Node.js 18+** | [nodejs.org](https://nodejs.org) |
| **MySQL** | Local or remote database |
| **Gemini API key** | Free tier at [Google AI Studio](https://aistudio.google.com/apikey) |

---

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and fill in your values:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
WEB_PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=customer_service_bot
ADMIN_PASSWORD=admin123
```

### 3. Database

```bash
npm run db:setup
```

### 4. Run API

```bash
npm start
```

- Web: `http://localhost:3000`
- Chat: `http://localhost:3000/chat.html`
- Outlets: `http://localhost:3000/outlets.html`
- Admin: `http://localhost:3000/admin/login.html`

### 5. Mobile app

```bash
npm run mobile:install
npm run mobile
```

Run Expo from `mobile/us-pizza-app` and point the app API URL to your machine's LAN IP.

---

## Project structure

```
├── src/
│   ├── index.js              # Entry point
│   ├── api/                  # Express routes (chat, complaints, admin, outlets)
│   ├── complaints/           # Complaint flow + AI analyzer
│   ├── outlets/              # Outlet service + state parser
│   ├── support/              # Support menu + chat handler
│   └── companyKnowledge.js   # Business info for bot replies
├── public/                   # Web UI (chat, complaints, admin, outlets)
├── mobile/us-pizza-app/      # Expo React Native app
├── db/                       # Migrations and seeds
└── uploads/                  # Complaint photo uploads
```

---

## NPM scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start API server |
| `npm run dev` | Start with auto-reload |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed bot config data |
| `npm run db:setup` | Migrate + seed |
| `npm run mobile` | Start Expo mobile app |
| `npm run mobile:install` | Install mobile app dependencies |

---

## Customize business info

Edit **`src/companyKnowledge.js`** — menu, hours, phone numbers, services, FAQ, etc.

Outlet data lives in the **`us_pizza_outlets`** MySQL table and is served via `GET /api/outlets`.

---

## Security — do NOT commit

- `.env` — API keys and database credentials
- `uploads/` — customer complaint photos

---

## License

MIT
