const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const {
  stopBotProcesses,
  removeStaleBrowserLocks,
  SESSION_DIR,
  CACHE_DIR,
} = require('../scripts/session-utils');

function normalizePhoneNumber(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  // Malaysian numbers often start with 0 — convert 014... to 6014...
  if (digits.startsWith('0')) {
    return `60${digits.slice(1)}`;
  }
  return digits;
}

function getLinkOptions() {
  const method = (process.env.WHATSAPP_LINK_METHOD || 'qr').toLowerCase();
  const phone = normalizePhoneNumber(
    process.env.WHATSAPP_PHONE || process.env.WHATSAPP_NUMBER || '60123456789',
  );

  if (method === 'pairing' || method === 'code' || method === 'phone') {
    return {
      method: 'pairing',
      phoneNumber: phone,
      pairWithPhoneNumber: {
        phoneNumber: phone,
        showNotification: true,
        intervalMs: 180000,
      },
    };
  }

  return { method: 'qr', phoneNumber: phone, pairWithPhoneNumber: undefined };
}

function hasExistingSession() {
  if (!fs.existsSync(SESSION_DIR)) return false;
  const markers = [
    path.join(SESSION_DIR, 'Default', 'Cookies'),
    path.join(SESSION_DIR, 'Default', 'IndexedDB', 'https_web.whatsapp.com_0.indexeddb.leveldb'),
  ];
  return markers.some((p) => fs.existsSync(p));
}

function getHeadlessSetting() {
  const env = process.env.WHATSAPP_HEADLESS;
  if (env === 'false') return false;
  return true;
}

function createWhatsAppClient() {
  const link = getLinkOptions();

  return new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(process.cwd(), '.wwebjs_auth') }),
    deviceName: 'US Pizza Bot',
    browserName: 'Chrome',
    ...(link.pairWithPhoneNumber ? { pairWithPhoneNumber: link.pairWithPhoneNumber } : {}),
    puppeteer: {
      headless: getHeadlessSetting(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
    authTimeoutMs: 180000,
    qrMaxRetries: 15,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 10000,
  });
}

function clearWebCache() {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
    console.log('🧹 Cleared .wwebjs_cache');
  }
}

function clearSession() {
  clearWebCache();
  const authDir = path.join(process.cwd(), '.wwebjs_auth');
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
    console.log('🧹 Cleared .wwebjs_auth — scan QR again after restart');
  }
}

function prepareBrowserSession() {
  removeStaleBrowserLocks();

  // Stale lockfile makes Puppeteer think Chrome is still running on Windows
  const lockfile = path.join(SESSION_DIR, 'lockfile');
  if (fs.existsSync(lockfile)) {
    try {
      fs.unlinkSync(lockfile);
      console.log('🧹 Removed stale browser lockfile');
    } catch {
      stopBotProcesses();
    }
  }
}

function isContextError(err) {
  const msg = err?.message || '';
  return msg.includes('Execution context was destroyed') || msg.includes('Protocol error');
}

async function startWhatsAppClient(attachHandlers, { maxAttempts = 3 } = {}) {
  clearWebCache();
  prepareBrowserSession();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = createWhatsAppClient();
    attachHandlers(client);

    try {
      await client.initialize();
      return client;
    } catch (err) {
      console.error(`\n❌ WhatsApp init failed (attempt ${attempt}/${maxAttempts}): ${err.message}`);

      try {
        await client.destroy();
      } catch {
        // ignore
      }

      if (!isContextError(err) || attempt === maxAttempts) {
        throw err;
      }

      stopBotProcesses();
      prepareBrowserSession();
      clearWebCache();
      console.log('🔄 Retrying with a fresh browser in 5 seconds...\n');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

module.exports = {
  createWhatsAppClient,
  startWhatsAppClient,
  clearWebCache,
  clearSession,
  getLinkOptions,
  normalizePhoneNumber,
  hasExistingSession,
};
