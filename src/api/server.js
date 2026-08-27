require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const complaintsRouter = require('./routes/complaints');
const chatRouter = require('./routes/chat');
const adminRouter = require('./routes/admin');
const outletsRouter = require('./routes/outlets');
const analyticsRouter = require('./routes/analytics');
const authRouter = require('./routes/auth');
const { ensureUploadDir } = require('./middleware/upload');

const app = express();
const PORT = Number(process.env.WEB_PORT || process.env.PORT || 3000);

ensureUploadDir();

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;

app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/complaints', complaintsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);
app.use('/api/outlets', outletsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/auth', authRouter);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Customer user portal (app-like SPA)
app.use('/portal', express.static(path.join(process.cwd(), 'us-pizza-user-portal')));

app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'US Pizza Customer Service API' });
});

app.get('/api/config', (_req, res) => {
  res.json({
    success: true,
    service: 'US Pizza Customer Support',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      chatSession: 'POST /api/chat/session',
      chatMessage: 'POST /api/chat/message',
      chatSubmit: 'POST /api/chat/submit',
      complaints: 'POST /api/complaints',
      outlets: 'GET /api/outlets',
      outletStates: 'GET /api/outlets/states',
      adminLogin: 'POST /api/admin/login',
      adminComplaints: 'GET /api/admin/complaints',
    },
    embed: {
      iframe: '/embed.html',
      widgetScript: '/sdk/embed-widget.js',
      clientScript: '/sdk/customer-support-client.js',
      demoApp: '/app-demo.html',
    },
  });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled API error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

function startWebServer() {
  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🍕 US Pizza Customer Service API`);
    console.log(`   Server:          http://localhost:${PORT} (LAN: use your PC IP on port ${PORT})`);
    console.log(`   App demo:        http://localhost:${PORT}/app-demo.html`);
    console.log(`   Embed (WebView): http://localhost:${PORT}/embed.html`);
    console.log(`   API config:      GET http://localhost:${PORT}/api/config`);
    console.log(`   Customer portal: http://localhost:${PORT}/portal/`);
    console.log(`   Admin dashboard: http://localhost:${PORT}/admin/login.html`);
    console.log(`\n   App integration endpoints:`);
    console.log(`   POST /api/chat/session       — start chat session`);
    console.log(`   POST /api/chat/message       — send message, get AI reply`);
    console.log(`   POST /api/chat/submit        — submit complaint + photos`);
    console.log(`   POST /api/complaints         — submit complaint form`);
    console.log(`   GET  /api/admin/complaints   — list complaints (auth)\n`);
  });
}

if (require.main === module) {
  startWebServer();
}

module.exports = { app, startWebServer };
