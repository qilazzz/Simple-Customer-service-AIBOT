require('dotenv').config();

const { createGeminiService } = require('./geminiService');
const { getLocalReply, tryLocalReply, tryOfflineReply } = require('./localFallback');
const knowledge = require('./companyKnowledge');
const { startWhatsAppClient, getLinkOptions } = require('./whatsappClient');
const { displayQr, removeQrFile } = require('./qrDisplay');
const { sendReply, formatError } = require('./messageSender');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const linkOptions = getLinkOptions();

let gemini;

try {
  gemini = createGeminiService(GEMINI_API_KEY, GEMINI_MODEL);
} catch (err) {
  console.error(`\n❌ ${err.message}\n`);
  console.log('Copy .env.example to .env and add your Gemini API key, then run again.\n');
  process.exit(1);
}

function attachHandlers(client) {
  if (linkOptions.method === 'pairing') {
    client.on('code', (code) => {
      console.log(`\n📱 Link with pairing code on phone ${knowledge.whatsappNumber}:\n`);
      console.log(`   CODE: ${code}\n`);
      console.log('   1. Open WhatsApp on the phone');
      console.log('   2. Settings → Linked Devices → Link a Device');
      console.log('   3. Choose "Link with phone number instead"');
      console.log(`   4. Enter this code: ${code}\n`);
    });
  } else {
    client.on('qr', async (qr) => {
      try {
        await displayQr(qr);
      } catch (err) {
        console.error('Could not save QR image:', err.message);
      }
    });
  }

  client.on('authenticated', () => {
    removeQrFile();
    console.log('✅ WhatsApp authenticated.');
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
  });

  client.on('ready', () => {
    removeQrFile();
    const linked = client.info?.wid?.user;

    console.log(`\n🍕 ${knowledge.companyName} WhatsApp bot is ready!`);
    if (linked) {
      console.log(`   Actually linked: ${linked} (customers message THIS number)`);
    }
    console.log(`   Configured in companyKnowledge: ${knowledge.whatsappNumber}`);
    if (linked) {
      const configDigits = knowledge.whatsappNumber.replace(/\D/g, '');
      const linkedDigits = String(linked).replace(/\D/g, '');
      const matches =
        linkedDigits.endsWith(configDigits.slice(1)) ||
        linkedDigits.endsWith(configDigits) ||
        configDigits.endsWith(linkedDigits.slice(2));
      if (!matches) {
        console.warn('   ⚠️  Linked phone ≠ configured number — update companyKnowledge.js or re-scan QR on the correct phone');
      }
    }
    console.log(`   Gemini model: ${GEMINI_MODEL}`);
    console.log('   📋 hardcoded = exact shortcuts (menu, hours, hi)  |  🤖 AI = recommendations, location, etc.\n');
  });

  client.on('disconnected', (reason) => {
    console.warn('⚠️  Client disconnected:', reason);
    console.log('   Restart the bot with: npm start');
  });

  client.on('message', async (msg) => {
    if (msg.fromMe) return;
    if (msg.from === 'status@broadcast') return;

    const body = msg.body?.trim();
    if (!body) return;

    console.log(`📩 Message from ${msg.from}: ${body.slice(0, 80)}${body.length > 80 ? '...' : ''}`);

    try {
      const result = await resolveReply(body);
      const { chatId } = await sendReply(client, msg, result.text);
      logReply(result, chatId);
    } catch (err) {
      console.error('❌ Error handling message:', formatError(err));

      const fallback =
        tryOfflineReply(body)?.text ||
        getLocalReply(body) ||
        `Sorry, AI is temporarily unavailable (Gemini free quota). Please try again later or contact ${knowledge.contactPerson.name} at ${knowledge.contactPerson.phone}.`;

      try {
        await sendReply(client, msg, fallback);
        logReply({ text: fallback, source: 'local', reason: 'error_fallback' }, msg.from);
      } catch (sendErr) {
        console.error('❌ Could not send fallback:', formatError(sendErr));
      }
    }
  });
}

async function resolveReply(body) {
  const local = tryLocalReply(body);
  if (local) return local;

  try {
    return await gemini.getReply(body);
  } catch (geminiErr) {
    const msg = formatError(geminiErr);
    if (geminiErr.quotaExceeded) {
      console.warn('⚠️  Gemini daily quota hit (free tier ~20 req/day). Using offline replies where possible.');
    } else {
      console.warn('⚠️  Gemini unavailable:', msg.slice(0, 200));
    }

    const offline = tryOfflineReply(body);
    if (offline) return offline;

    throw geminiErr;
  }
}

function logReply(result, chatId) {
  const { text, source, model, intent, reason } = result;

  if (source === 'ai') {
    console.log(`🤖 Replied [AI · ${model}] → ${chatId} (${text.length} chars)`);
    console.log(`   Preview: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
    return;
  }

  const label = intent ? `${intent}` : 'hardcoded';
  const reasonLabel =
    reason === 'matched_intent' ? 'known topic' :
    reason === 'gemini_down' ? 'Gemini down — offline answer' :
    reason === 'error_fallback' ? 'error fallback' :
    'hardcoded match';

  console.log(`📋 Replied [LOCAL · ${label}] → ${chatId} (${text.length} chars) — ${reasonLabel}`);
  console.log(`   Preview: ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
}

async function start() {
  console.log(`\nStarting ${knowledge.companyName} WhatsApp bot...`);
  console.log(`Link method: ${linkOptions.method}${linkOptions.phoneNumber ? ` (${linkOptions.phoneNumber})` : ''}`);

  try {
    await startWhatsAppClient(attachHandlers, { maxAttempts: 3 });
  } catch {
    console.error('\n❌ Could not start WhatsApp bot. Try:');
    console.error('  1. npm run reset-session');
    console.error('  2. Close other WhatsApp Web / linked devices on the phone');
    console.error('  3. npm start\n');
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  if (msg.includes('Execution context was destroyed') || msg.includes('Protocol error')) {
    console.error('\n⚠️  WhatsApp browser crashed. Restart with: npm start\n');
  }
});

start().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
