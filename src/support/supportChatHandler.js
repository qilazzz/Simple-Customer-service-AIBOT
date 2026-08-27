const {
  getStageReply,
  formatOutletOptions,
  needsGuestContact,
  getContactStep,
  applyGuestDetails,
} = require('../complaints/complaintChatFlow');
const { processComplaintChatTurn } = require('../complaints/aiComplaintAnalyzer');
const outletService = require('../outlets/outletService');
const {
  SUPPORT_MENU,
  parseMenuChoice,
  isBackToMenuCommand,
  getInfoReply,
  getOrderStatusPrompt,
  getOrderStatusReply,
} = require('./supportMenu');
const {
  getMenuSubPrompt,
  getMenuSubMenuOptions,
  parseMenuSubChoice,
  getMenuSubReply,
} = require('./menuSubFlow');
const { processSupportChatMessage } = require('./supportChatAi');
const liveChatService = require('../liveChat/liveChatService');

const LIVE_AGENT_REPLY =
  "You're now connected to our live support queue. A US Pizza support agent will join shortly — please share your question and we'll help you right away.";

async function startLiveAgentFlow(session, context = {}) {
  const history = (session.messages || []).map((message) => ({
    role: message.role === 'customer' ? 'customer' : 'ai',
    text: message.text,
  }));

  let liveSession = await liveChatService.createOrGetLiveChatSession({
    chatSessionId: context.chatSessionId,
    userId: context.userId || session.userId || null,
    customerName: session.collected?.customer_name,
    customerContact: session.collected?.customer_contact,
    outletName: session.collected?.outlet_name,
    history,
  });

  const hasQueueMessage = (liveSession.messages || []).some(
    (message) => message.message_text === LIVE_AGENT_REPLY,
  );

  if (!hasQueueMessage) {
    await liveChatService.addLiveChatMessage(liveSession.id, 'bot', LIVE_AGENT_REPLY);
    liveSession = await liveChatService.getLiveChatSessionById(liveSession.id);
  }

  session.flow = 'live_agent';
  session.stage = 'live_agent';
  session.liveSessionId = liveSession.id;
  session.liveStatus = liveSession.status;

  const lastLiveMessageId = liveSession.messages?.length
    ? Math.max(...liveSession.messages.map((message) => message.id))
    : 0;

  return {
    reply: LIVE_AGENT_REPLY,
    stage: 'live_agent',
    flow: 'live_agent',
    show_menu: false,
    ready_to_submit: false,
    live_agent: true,
    liveSessionId: liveSession.id,
    last_live_message_id: lastLiveMessageId,
    waiting_for_agent: liveSession.status === 'WAITING_FOR_AGENT',
    menu_options: SUPPORT_MENU,
    menu_bar_title: 'Main menu',
  };
}

function menuResponse(reply, extra = {}) {
  return {
    reply,
    stage: 'menu',
    flow: 'menu',
    show_menu: true,
    ready_to_submit: false,
    menu_options: SUPPORT_MENU,
    menu_bar_title: 'Main menu',
    ...extra,
  };
}

function menuSubResponse(reply, extra = {}) {
  return {
    reply,
    stage: 'menu_sub',
    flow: 'menu_browse',
    show_menu: true,
    ready_to_submit: false,
    menu_options: getMenuSubMenuOptions(true),
    menu_bar_title: 'Menu options',
    ...extra,
  };
}

function resetToMenu(session) {
  session.flow = 'menu';
  session.stage = 'menu';
}

function joinReply(intro, body) {
  if (!intro?.trim()) return body;
  if (!body?.trim()) return intro.trim();
  return `${intro.trim()}\n\n${body.trim()}`;
}

async function startComplaintFlow(session, aiReply = null) {
  session.flow = 'complaint';
  session.collected = session.collected || {};

  if (needsGuestContact(session.collected, session)) {
    const contactStep = getContactStep(session.collected);
    session.stage = 'contact';
    return {
      reply: joinReply(aiReply, getStageReply('contact', session.collected, contactStep)),
      stage: 'contact',
      flow: 'complaint',
      show_menu: false,
      ready_to_submit: false,
      needs_guest_contact: true,
      contact_step: contactStep,
      menu_options: SUPPORT_MENU,
      menu_bar_title: 'Main menu',
      outlet_options: [],
    };
  }

  session.stage = 'outlet';
  const outlets = await outletService.listOutletsForPicker();

  return {
    reply: joinReply(aiReply, getStageReply('outlet')),
    stage: 'outlet',
    flow: 'complaint',
    show_menu: false,
    ready_to_submit: false,
    menu_options: SUPPORT_MENU,
    menu_bar_title: 'Main menu',
    outlet_options: formatOutletOptions(outlets),
    needs_guest_contact: false,
  };
}

/**
 * @param {Object} session
 * @param {string} intent
 * @param {string} userMessage
 * @param {string|null} aiReply
 */
async function routeByIntent(session, intent, userMessage, aiReply = null, context = {}) {
  switch (intent) {
    case 'order_status':
      session.flow = 'order_status';
      session.stage = 'order_status_id';
      return {
        reply: joinReply(aiReply, getOrderStatusPrompt()),
        stage: 'order_status_id',
        flow: 'order_status',
        show_menu: false,
        ready_to_submit: false,
        menu_options: SUPPORT_MENU,
        menu_bar_title: 'Main menu',
      };

    case 'order_issue':
      return startComplaintFlow(session, aiReply);

    case 'menu':
      session.flow = 'menu_browse';
      session.stage = 'menu_sub';
      return menuSubResponse(joinReply(aiReply, getMenuSubPrompt()));

    case 'find_outlet': {
      resetToMenu(session);
      const outletReply = await getInfoReply('find_outlet', userMessage);
      return menuResponse(joinReply(aiReply, outletReply));
    }

    case 'promotions': {
      resetToMenu(session);
      const promoReply = await getInfoReply('promotions', userMessage);
      return menuResponse(joinReply(aiReply, promoReply));
    }

    case 'other':
      return startLiveAgentFlow(session, {
        chatSessionId: context.chatSessionId,
        userId: context.userId || session.userId,
      });

    default:
      return menuResponse(aiReply || 'How can I help you today?');
  }
}

/**
 * @param {Object} session
 * @param {string} userMessage
 */
async function processSupportChatTurn(session, userMessage, context = {}) {
  session.flow = session.flow || 'menu';
  session.stage = session.stage || 'menu';
  if (context.userId) session.userId = context.userId;

  if (session.flow === 'live_agent') {
    return {
      reply: null,
      stage: 'live_agent',
      flow: 'live_agent',
      show_menu: false,
      ready_to_submit: false,
      live_agent: true,
      liveSessionId: session.liveSessionId,
      waiting_for_agent: session.liveStatus === 'WAITING_FOR_AGENT',
      menu_options: SUPPORT_MENU,
      menu_bar_title: 'Main menu',
    };
  }

  if (isBackToMenuCommand(userMessage)) {
    resetToMenu(session);
    return menuResponse('You\'re back at the main menu. How can I help you?');
  }

  if (session.flow === 'menu_browse') {
    const subChoice = parseMenuSubChoice(userMessage);

    if (subChoice === 'back_main') {
      resetToMenu(session);
      return menuResponse('You\'re back at the main menu. How can I help you?');
    }

    if (!subChoice) {
      const aiResult = await processSupportChatMessage(userMessage, session.messages || []);
      if (aiResult.intent && aiResult.intent !== 'general') {
        return routeByIntent(session, aiResult.intent, userMessage, aiResult.reply, context);
      }
      return menuSubResponse(
        aiResult.reply ||
          'Tap one of the menu options below to explore, or choose Back to Main Menu.',
      );
    }

    return menuSubResponse(getMenuSubReply(subChoice));
  }

  if (session.flow === 'menu' || session.stage === 'menu') {
    const choice = parseMenuChoice(userMessage);

    if (!choice) {
      const aiResult = await processSupportChatMessage(userMessage, session.messages || []);
      if (aiResult.intent && aiResult.intent !== 'general') {
        return routeByIntent(session, aiResult.intent, userMessage, aiResult.reply, context);
      }
      return menuResponse(
        aiResult.reply ||
          'How can I help you today? You can ask me anything or tap an option below.',
      );
    }

    if (choice === 'order_status') {
      session.flow = 'order_status';
      session.stage = 'order_status_id';
      return {
        reply: getOrderStatusPrompt(),
        stage: 'order_status_id',
        flow: 'order_status',
        show_menu: false,
        ready_to_submit: false,
        menu_options: SUPPORT_MENU,
        menu_bar_title: 'Main menu',
      };
    }

    if (choice === 'order_issue') {
      return startComplaintFlow(session);
    }

    if (choice === 'menu') {
      session.flow = 'menu_browse';
      session.stage = 'menu_sub';
      return menuSubResponse(getMenuSubPrompt());
    }

    if (choice === 'other') {
      return startLiveAgentFlow(session, {
        chatSessionId: context.chatSessionId,
        userId: context.userId || session.userId,
      });
    }

    resetToMenu(session);
    const reply = await getInfoReply(choice, userMessage);
    return menuResponse(reply);
  }

  if (session.flow === 'order_status') {
    const orderId = userMessage.trim();
    if (orderId.length < 2) {
      return {
        reply: 'Please enter a valid Order ID or receipt number.',
        stage: 'order_status_id',
        flow: 'order_status',
        show_menu: false,
        ready_to_submit: false,
        menu_options: SUPPORT_MENU,
        menu_bar_title: 'Main menu',
      };
    }

    session.collected = { ...session.collected, order_id: orderId };
    resetToMenu(session);
    return menuResponse(getOrderStatusReply(orderId), {
      collected: session.collected,
    });
  }

  if (session.flow === 'complaint') {
    const result = await processComplaintChatTurn(session, userMessage);
    return {
      ...result,
      flow: 'complaint',
      show_menu: false,
      menu_options: SUPPORT_MENU,
      menu_bar_title: 'Main menu',
    };
  }

  resetToMenu(session);
  return menuResponse('How can I help you today?');
}

module.exports = {
  processSupportChatTurn,
  startLiveAgentFlow,
  SUPPORT_MENU,
};
