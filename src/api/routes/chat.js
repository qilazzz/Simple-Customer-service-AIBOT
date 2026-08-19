const express = require('express');
const complaintService = require('../../complaints/complaintService');
const liveChatService = require('../../liveChat/liveChatService');
const chatPersistence = require('../../chat/chatPersistenceService');
const {
  createSession,
  getSession,
  appendMessage,
  updateCollected,
  destroySession,
} = require('../../complaints/chatSessionStore');
const { buildTicketConfirmation } = require('../../complaints/complaintChatFlow');
const { processSupportChatTurn, startLiveAgentFlow, SUPPORT_MENU } = require('../../support/supportChatHandler');
const { getMenuWelcomeText, cleanBotReply } = require('../../support/supportMenu');
const { handlePhotoUpload } = require('../middleware/upload');
const { optionalCustomer, requireCustomer } = require('../middleware/customerAuth');

const router = express.Router();

function isDirectSupportRequest(req) {
  return req.body?.direct_support === true || req.query?.direct_support === 'true';
}

function attachCustomerProfile(session, customer) {
  if (!customer) return;
  session.userId = customer.user_id;
  session.collected = {
    ...(session.collected || {}),
    customer_name: customer.name,
    customer_contact: customer.email || customer.phone_number,
    customer_email: customer.email,
  };
}

function formatDirectSupportPayload(sessionId, session, result, customer, extra = {}) {
  return {
    success: true,
    sessionId,
    chat_status: 'TALK_TO_SUPPORT',
    stage: result.stage || 'live_agent',
    flow: result.flow || 'live_agent',
    show_menu: false,
    ready_to_submit: false,
    live_agent: true,
    live_session_id: result.liveSessionId || session.liveSessionId || null,
    last_live_message_id: result.last_live_message_id || 0,
    waiting_for_agent: result.waiting_for_agent ?? session.liveStatus === 'WAITING_FOR_AGENT',
    reply: result.reply || null,
    user: customer || null,
    ...extra,
  };
}

async function persistDirectSupportSession(sessionId, session, customer, result) {
  if (!customer?.user_id) return;

  try {
    const existing = await chatPersistence.getActiveSessionRow(customer.user_id);
    if (!existing) {
      await chatPersistence.createPersistedSession(sessionId, customer.user_id, {
        flow: 'live_agent',
        stage: 'live_agent',
        live_session_id: result.liveSessionId || session.liveSessionId || null,
        collected: session.collected,
      });
    } else {
      await chatPersistence.updatePersistedSession(sessionId, {
        flow: 'live_agent',
        stage: 'live_agent',
        live_session_id: result.liveSessionId || session.liveSessionId || null,
        collected: session.collected,
      });
    }

    if (result.reply) {
      await chatPersistence.persistMemoryMessage(sessionId, 'bot', result.reply);
    }
  } catch (err) {
    console.error('Direct support persist error:', err.message);
  }
}

async function initializeDirectSupportSession(sessionId, session, customer, context = {}) {
  session.directSupport = true;
  session.chat_status = 'TALK_TO_SUPPORT';
  attachCustomerProfile(session, customer);

  const result = await startLiveAgentFlow(session, {
    chatSessionId: sessionId,
    userId: customer?.user_id || context.userId || session.userId || null,
  });

  if (result.reply) {
    appendMessage(sessionId, 'ai', result.reply);
  }

  await persistDirectSupportSession(sessionId, session, customer, result);

  return formatDirectSupportPayload(sessionId, session, result, customer, context.extra || {});
}

async function buildResumeResponse(history, customer) {
  return {
    success: true,
    resumed: true,
    sessionId: history.sessionId,
    messages: history.messages,
    stage: history.stage,
    flow: history.flow,
    chat_status: 'TALK_TO_SUPPORT',
    show_menu: false,
    ready_to_submit: false,
    live_agent: history.live_agent,
    live_session_id: history.live_session_id,
    last_live_message_id: history.last_live_message_id || 0,
    waiting_for_agent: history.waiting_for_agent || false,
    user: customer || null,
  };
}

router.get('/history', requireCustomer, async (req, res) => {
  try {
    const directSupport = isDirectSupportRequest(req);
    const history = await chatPersistence.buildHistoryPayload(req.customer.user_id);

    if (!history.found) {
      return res.json({
        success: true,
        found: false,
        messages: [],
        chat_status: directSupport ? 'TALK_TO_SUPPORT' : null,
      });
    }

    if (directSupport && !history.live_agent) {
      const session = getSession(history.sessionId) || chatPersistence.restoreMemorySession(
        await chatPersistence.getActiveSessionRow(req.customer.user_id),
        history.messages,
      );
      if (session) {
        const payload = await initializeDirectSupportSession(
          history.sessionId,
          session,
          req.customer,
          { extra: { resumed: true, found: true, messages: history.messages } },
        );
        payload.messages = history.messages;
        return res.json(payload);
      }
    }

    const response = await buildResumeResponse(history, req.customer);
    return res.json({
      success: true,
      found: true,
      ...response,
    });
  } catch (err) {
    console.error('Chat history error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load chat history.' });
  }
});

router.post('/session', optionalCustomer, async (req, res) => {
  const directSupport = isDirectSupportRequest(req);

  if (directSupport) {
    if (req.customer) {
      try {
        const history = await chatPersistence.buildHistoryPayload(req.customer.user_id);
        if (history.found) {
          if (!history.live_agent) {
            const row = await chatPersistence.getActiveSessionRow(req.customer.user_id);
            const session = chatPersistence.restoreMemorySession(row, history.messages);
            if (session) {
              const payload = await initializeDirectSupportSession(
                history.sessionId,
                session,
                req.customer,
                { extra: { resumed: true, messages: history.messages } },
              );
              payload.messages = history.messages;
              return res.json(payload);
            }
          }
          return res.json({
            ...(await buildResumeResponse(history, req.customer)),
            found: true,
          });
        }
      } catch (err) {
        console.error('Direct support resume error:', err.message);
      }
    }

    const sessionId = createSession();
    const session = getSession(sessionId);
    attachCustomerProfile(session, req.customer);

    try {
      const payload = await initializeDirectSupportSession(sessionId, session, req.customer, {
        extra: { resumed: false },
      });
      return res.json(payload);
    } catch (err) {
      console.error('Direct support session error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Could not connect to live support.',
      });
    }
  }

  if (req.customer) {
    try {
      const history = await chatPersistence.buildHistoryPayload(req.customer.user_id);
      if (history.found) {
        return res.json(await buildResumeResponse(history, req.customer));
      }
    } catch (err) {
      console.error('Chat session resume error:', err.message);
    }
  }

  const sessionId = createSession();
  const session = getSession(sessionId);

  if (req.customer) {
    session.userId = req.customer.user_id;
    session.collected = {
      ...(session.collected || {}),
      customer_name: req.customer.name,
      customer_contact: req.customer.email || req.customer.phone_number,
      customer_email: req.customer.email,
    };

    try {
      await chatPersistence.createPersistedSession(sessionId, req.customer.user_id, {
        flow: 'menu',
        stage: 'menu',
        collected: session.collected,
      });
    } catch (err) {
      console.error('Chat session persist error:', err.message);
    }
  }

  const greeting = getMenuWelcomeText();

  appendMessage(sessionId, 'ai', greeting);

  if (req.customer) {
    try {
      await chatPersistence.persistMemoryMessage(sessionId, 'ai', greeting);
    } catch (err) {
      console.error('Chat greeting persist error:', err.message);
    }
  }

  return res.json({
    success: true,
    sessionId,
    resumed: false,
    reply: greeting,
    stage: 'menu',
    flow: 'menu',
    show_menu: true,
    ready_to_submit: false,
    menu_options: SUPPORT_MENU,
    user: req.customer || null,
  });
});

router.get('/live-updates', async (req, res) => {
  const { sessionId, sinceId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'sessionId is required.' });
  }

  try {
    const updates = await liveChatService.getLiveChatUpdatesForCustomer(
      sessionId,
      sinceId ? Number(sinceId) : 0,
    );

    return res.json({
      success: true,
      ...updates,
    });
  } catch (err) {
    console.error('Live updates error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not load live chat updates.' });
  }
});

router.post('/message', optionalCustomer, async (req, res) => {
  const { sessionId, message, user_id: bodyUserId } = req.body;

  if (!sessionId || !message?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'sessionId and message are required.',
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Chat session expired. Please start again.' });
  }

  if (req.customer) {
    session.userId = req.customer.user_id;
    session.collected = {
      ...(session.collected || {}),
      customer_name: req.customer.name,
      customer_contact: req.customer.email || req.customer.phone_number,
      customer_email: req.customer.email,
    };
  }

  if (session.directSupport && session.flow !== 'live_agent') {
    try {
      const escalate = await startLiveAgentFlow(session, {
        chatSessionId: sessionId,
        userId: req.customer?.user_id || bodyUserId || session.userId || null,
      });
      session.flow = 'live_agent';
      session.stage = 'live_agent';
      session.liveSessionId = escalate.liveSessionId;
      session.liveStatus = escalate.waiting_for_agent ? 'WAITING_FOR_AGENT' : 'AGENT_CONNECTED';
    } catch (err) {
      console.error('Direct support re-escalation error:', err.message);
    }
  }

  if (session.flow !== 'live_agent' || !session.liveSessionId) {
    try {
      const latestLive = await liveChatService.getLatestLiveChatByChatSessionId(sessionId);
      if (latestLive) {
        session.flow = 'live_agent';
        session.stage = 'live_agent';
        session.liveSessionId = latestLive.id;
        session.liveStatus = latestLive.status;
      }
    } catch (err) {
      console.error('Live session reattach error:', err.message);
    }
  }

  appendMessage(sessionId, 'customer', message.trim());
  chatPersistence.persistMemoryMessage(sessionId, 'customer', message.trim()).catch(() => {});

  if (session.flow === 'live_agent' && session.liveSessionId) {
    try {
      const savedMessage = await liveChatService.addLiveChatMessage(
        session.liveSessionId,
        'user',
        message.trim(),
        { incrementUnread: true },
      );

      return res.json({
        success: true,
        reply: null,
        chat_status: 'TALK_TO_SUPPORT',
        flow: 'live_agent',
        stage: 'live_agent',
        live_agent: true,
        show_menu: false,
        ready_to_submit: false,
        waiting_for_agent: true,
        live_session_id: session.liveSessionId,
        last_live_message_id: savedMessage.id,
      });
    } catch (err) {
      console.error('Live agent message error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Could not send your message to our support team.',
      });
    }
  }

  try {
    const result = await processSupportChatTurn(session, message.trim(), {
      chatSessionId: sessionId,
      userId: req.customer?.user_id || bodyUserId || session.userId || null,
    });
    updateCollected(sessionId, result.collected || session.collected);

    session.flow = result.flow || session.flow;
    session.stage = result.stage || session.stage;
    if (result.liveSessionId) session.liveSessionId = result.liveSessionId;
    if (result.liveStatus) session.liveStatus = result.liveStatus;
    if (result.live_agent) session.flow = 'live_agent';

    if (result.stage === 'photo') {
      session.photoPromptShown = true;
    }

    const reply = result.reply ? cleanBotReply(result.reply) : null;
    if (reply) {
      appendMessage(sessionId, 'ai', reply);
      chatPersistence.persistMemoryMessage(sessionId, 'ai', reply).catch(() => {});
    }

    chatPersistence
      .updatePersistedSession(sessionId, {
        flow: session.flow,
        stage: session.stage,
        live_session_id: session.liveSessionId || null,
        collected: session.collected,
      })
      .catch(() => {});

    return res.json({
      success: true,
      reply,
      collected: session.collected,
      ready_to_submit: result.ready_to_submit,
      stage: result.stage,
      flow: result.flow,
      show_menu: Boolean(result.show_menu),
      menu_options: result.menu_options || SUPPORT_MENU,
      menu_bar_title: result.menu_bar_title,
      outlet_options: result.outlet_options || null,
      preview: result.preview,
      live_agent: Boolean(result.live_agent),
      live_session_id: result.liveSessionId || session.liveSessionId || null,
      last_live_message_id: result.last_live_message_id || null,
      waiting_for_agent: result.waiting_for_agent || false,
    });
  } catch (err) {
    console.error('Chat error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Our support assistant is temporarily unavailable. Please try again in a moment.',
    });
  }
});

router.post('/submit', handlePhotoUpload, async (req, res) => {
  const { sessionId } = req.body;
  const session = getSession(sessionId);

  if (!session) {
    return res.status(404).json({ success: false, message: 'Chat session expired. Please start again.' });
  }

  if (session.flow !== 'complaint') {
    return res.status(400).json({
      success: false,
      message: 'No active complaint to submit. Choose Order Issue / Complaint from the menu first.',
      stage: 'menu',
      show_menu: true,
    });
  }

  const collected = { ...session.collected };
  const missing = [];

  if (!collected.outlet_name) missing.push('outlet');
  if (!collected.description) missing.push('complaint details');

  if (missing.length) {
    const stageMap = {
      outlet: 'outlet',
      'complaint details': 'description',
    };
    return res.status(400).json({
      success: false,
      message: `We still need your ${missing.join(', ')} before we can log your ticket.`,
      stage: stageMap[missing[0]] || 'outlet',
    });
  }

  try {
    const files = req.files || [];
    const chatMessages = session.messages.map((m) => ({
      sender: m.role === 'customer' ? 'customer' : 'ai',
      message_text: m.text,
    }));

    const attachmentUrls = files.map((f) => `/uploads/complaints/${f.filename}`);
    const contact =
      collected.customer_contact ||
      `app-user-${sessionId.slice(0, 8)}@uspizza.local`;

    const complaint = await complaintService.createComplaint(
      {
        customer_name: collected.customer_name || 'Chat Customer',
        customer_contact: contact,
        customer_email: contact.includes('@') ? contact : 'chatbot@uspizza.local',
        customer_phone: contact.includes('@') ? null : contact,
        order_id: collected.order_id || null,
        outlet_name: collected.outlet_name,
        outlet_id: collected.outlet_id || null,
        complaint_category: collected.complaint_category || 'other',
        description: collected.description,
        priority: collected.priority || 'Medium',
        attachment_urls: attachmentUrls,
        source: 'chatbot',
      },
      { files, chatMessages },
    );

    const confirmation = buildTicketConfirmation(complaint.id);
    chatPersistence.closePersistedSession(sessionId).catch(() => {});
    destroySession(sessionId);

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      ticket_id: complaint.id,
      reply: confirmation,
      complaint,
    });
  } catch (err) {
    console.error('Chat submit error:', err.message, err.stack);
    return res.status(500).json({
      success: false,
      message: 'We could not log your complaint right now. Please try again.',
    });
  }
});

module.exports = router;
