function formatError(err) {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return String(err);
}

async function collectChatIds(client, msg) {
  const ids = new Set();

  if (msg.from) ids.add(msg.from);
  if (msg.author) ids.add(msg.author);

  try {
    const chat = await msg.getChat();
    if (chat?.id?._serialized) ids.add(chat.id._serialized);
  } catch {
    // ignore
  }

  for (const id of [...ids]) {
    try {
      const resolved = await client.getContactLidAndPhone(id);
      for (const entry of resolved) {
        if (entry.lid) ids.add(entry.lid);
        if (entry.pn) ids.add(entry.pn);
      }
    } catch {
      // ignore per-id resolution failures
    }
  }

  return [...ids].filter(Boolean);
}

async function sendReply(client, msg, text) {
  const chatIds = await collectChatIds(client, msg);
  const errors = [];

  for (const chatId of chatIds) {
    try {
      await client.sendMessage(chatId, text, { sendSeen: false });
      return { chatId };
    } catch (err) {
      errors.push(`${chatId}: ${formatError(err)}`);
    }
  }

  throw new Error(errors.length ? errors.join(' | ') : 'No valid chat ID to send to');
}

module.exports = { sendReply, formatError };
