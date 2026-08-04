# Simple Customer Service AI Bot

WhatsApp customer service bot powered by **Google Gemini AI**. Built for small businesses to answer FAQs automatically, with smart AI replies for open-ended questions.

**Stack:** [whatsapp-web.js](https://wwebjs.dev/) · Google Gemini · Node.js

**Repository:** [github.com/qilazzz/Simple-Customer-service-AIBOT](https://github.com/qilazzz/Simple-Customer-service-AIBOT)

---

## Features

- WhatsApp auto-reply via QR code linking (no official WhatsApp Business API required)
- **Hardcoded shortcuts** for common queries (`menu`, `hours`, `hello`, `outlets`, etc.)
- **Gemini AI** for recommendations, follow-ups, and natural conversation
- **Offline fallback** when Gemini quota is exceeded
- PNG QR code (auto-opens on Windows) — no broken terminal QR
- Session persistence — scan QR once, reuse session
- Logs show `🤖 AI` vs `📋 LOCAL` so you know which engine replied

---

## Requirements

| Requirement | Notes |
|-------------|-------|
| **Node.js 18+** | [nodejs.org](https://nodejs.org) |
| **WhatsApp account** | The phone that scans the QR becomes the bot number |
| **Gemini API key** | Free tier at [Google AI Studio](https://aistudio.google.com/apikey) |
| **Windows / macOS / Linux** | Tested on Windows |

> **Important:** The number in `companyKnowledge.js` is what the bot *tells* customers. The **actual** bot number is whichever phone scanned the QR. Check the startup log: `Actually linked: ...`

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/qilazzz/Simple-Customer-service-AIBOT.git
cd Simple-Customer-service-AIBOT
npm install
```

### 2. Environment variables

```bash
copy .env.example .env    # Windows
# cp .env.example .env    # macOS / Linux
```

Edit `.env`:

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
WHATSAPP_HEADLESS=true
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | From [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | No | Default: `gemini-2.5-flash` (avoid `gemini-2.0-flash` on free tier) |
| `WHATSAPP_HEADLESS` | No | `true` = no Chrome popup (default). `false` = show browser |
| `WHATSAPP_LINK_METHOD` | No | `qr` (default) or `pairing` |
| `WHATSAPP_PHONE` | No | For pairing mode — country code + number, e.g. `60123456789` |

### 3. Customize your business

Edit **`src/companyKnowledge.js`** — menu, hours, outlets, services, contact person, etc. This file feeds both hardcoded replies and the AI system prompt.

### 4. Run the bot

```bash
npm start
```

Scan the QR code with the WhatsApp account you want to use as the bot:

**Phone → Settings → Linked Devices → Link a Device → Scan QR**

(`whatsapp-qr.png` opens automatically on Windows.)

### 5. Stop / reset

```bash
npm run stop            # Stop bot process
npm run reset-session   # Clear session — scan QR again
npm start               # Start again
```

---

## How replies work

```
Customer message
       │
       ▼
  Exact shortcut?  ──yes──►  📋 Hardcoded reply (menu, hours, hello…)
       │
       no
       ▼
  Gemini AI available?  ──yes──►  🤖 Smart AI reply
       │
       no (quota / error)
       ▼
  Offline pattern match?  ──yes──►  📋 Fallback from companyKnowledge
       │
       no
       ▼
  Generic error + contact person
```

**Out-of-scope questions** (weather, coding, unrelated topics) → AI redirects to your contact person defined in `companyKnowledge.js`.

---

## Project structure

```
├── src/
│   ├── index.js           # Entry point, message handler
│   ├── companyKnowledge.js # ← Edit this: your business data
│   ├── geminiService.js   # Gemini AI + prompts
│   ├── localFallback.js   # Hardcoded / offline replies
│   ├── messageSender.js   # WhatsApp send (handles @lid chats)
│   ├── whatsappClient.js  # WhatsApp client setup
│   └── qrDisplay.js       # Saves QR as whatsapp-qr.png
├── scripts/
│   ├── reset-session.js   # Clear WhatsApp session
│   ├── stop-bot.js        # Stop running bot
│   └── start-pairing.js   # Link via phone code instead of QR
├── .env.example           # Template (copy to .env)
└── package.json
```

---

## NPM scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the bot |
| `npm run stop` | Stop bot + clear browser locks |
| `npm run reset-session` | Full session reset (re-scan QR) |
| `npm run start:pairing` | Link via 8-digit code instead of QR |
| `npm run dev` | Start with auto-reload |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| QR won't scan | Use `whatsapp-qr.png` (not terminal ASCII). Run `npm run reset-session` |
| "Browser already running" | `npm run stop` then `npm run reset-session` |
| Gemini 429 / quota | Free tier ≈ 20 req/day. Wait or enable billing. Offline fallbacks still work |
| Bot replies wrong number | Whichever phone scanned QR is the real bot — check startup log |
| `@lid` send errors | Already handled in `messageSender.js` |
| "Can't link new devices" | Wait 1–24h, remove old linked devices, update WhatsApp app |

---

## Security — do NOT commit

These are in `.gitignore` and must stay local:

- `.env` — Gemini API key
- `.wwebjs_auth/` — WhatsApp session (like browser cookies)
- `.wwebjs_cache/` — WhatsApp web cache
- `whatsapp-qr.png` — temporary login QR

---

## Gemini free tier notes

- Use **`gemini-2.5-flash`** (default)
- **`gemini-2.0-flash`** often has `limit: 0` on free tier
- Bot auto-retries on rate limit and falls back to hardcoded answers

---

## License

MIT — use freely, customize for your business.

## Author

Built by [qilazzz](https://github.com/qilazzz)
