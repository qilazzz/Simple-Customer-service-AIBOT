const { GoogleGenerativeAI } = require('@google/generative-ai');
const { VALID_PRIORITIES } = require('./complaintTypes');
const { normalizeSentiment } = require('./ticketAiSummary');
const {
  getCurrentStage,
  getStageReply,
  parseOutletChoice,
  formatOutletOptions,
  isComplaintTrigger,
  isSubmitCommand,
  isPhotoSkip,
  needsGuestContact,
  getContactStep,
  processContactInput,
  validateOrderId,
} = require('./complaintChatFlow');
const outletService = require('../outlets/outletService');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const SUPPORT_PERSONA = `You are a helpful and empathetic Customer Care Support Agent for US Pizza Malaysia.

Customers may write in Bahasa Melayu, English, Manglish, or informal Malaysian slang/short-form (e.g. "tak sama", "tibe ii", "dpt"). Always understand their intent regardless of language or spelling.

When a customer logs a complaint, gather:
1. Which outlet they ordered from or visited
2. Their order ID or receipt number
3. What went wrong (description)

Be empathetic and concise. Reply in the same language the customer uses when possible (Malay for BM/Manglish, English otherwise).`;

function buildExtractionPrompt(conversationText, collected, currentStage) {
  return `${SUPPORT_PERSONA}

Current stage: ${currentStage}
Already collected: ${JSON.stringify(collected)}

Multilingual extraction rules (IMPORTANT):
- Parse customer text in ANY language or informal Malaysian short-form.
- Normalize slang (e.g. "tak sama" = wrong item, "tibe ii" = instead/suddenly).
- Write "description" and "ai_summary" in clear English for admin staff, even when the customer wrote in Malay/Manglish.
- Do NOT leave fields empty just because the input is not formal English.

Analyze the conversation and respond ONLY with valid JSON (no markdown):
{
  "outlet_name": "matched outlet name or null",
  "description": "clear English summary of what went wrong or null",
  "sentiment": "positive|neutral|negative|angry|frustrated",
  "priority": "Low|Medium|High",
  "ai_summary": "2-3 sentence internal summary in English for admin staff only"
}

Conversation:
${conversationText}`;
}

function parseJsonResponse(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI did not return valid JSON.');
  return JSON.parse(match[0]);
}

async function extractComplaintEntities(conversationText, collected = {}, currentStage = 'outlet') {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      outlet_name: null,
      description: null,
      sentiment: 'neutral',
      priority: 'Medium',
      ai_summary: '',
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: DEFAULT_MODEL,
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
  });

  const result = await model.generateContent(
    buildExtractionPrompt(conversationText, collected, currentStage),
  );
  const parsed = parseJsonResponse(result.response.text());

  return {
    outlet_name: parsed.outlet_name || null,
    description: parsed.description || null,
    sentiment: normalizeSentiment(parsed.sentiment),
    priority: VALID_PRIORITIES.includes(parsed.priority) ? parsed.priority : 'Medium',
    ai_summary: parsed.ai_summary || '',
  };
}

async function getOutletsForSession(session) {
  if (!session._outletsCache) {
    session._outletsCache = await outletService.listOutletsForPicker();
  }
  return session._outletsCache;
}

/**
 * Process one chat turn: capture outlet + description, return customer reply.
 * @param {Object} session
 * @param {string} userMessage
 */
async function processComplaintChatTurn(session, userMessage) {
  const outlets = await getOutletsForSession(session);
  const conversationText = session.messages.map((m) => `${m.role}: ${m.text}`).join('\n');
  const stageBefore = getCurrentStage(session.collected, session);

  if (stageBefore === 'contact') {
    const contactResult = processContactInput(session.collected || {}, userMessage);
    session.collected = contactResult.collected;

    if (!contactResult.done) {
      const reply =
        contactResult.error ||
        getStageReply('contact', session.collected, contactResult.contact_step);
      return {
        reply,
        collected: session.collected,
        ready_to_submit: false,
        stage: 'contact',
        needs_guest_contact: true,
        contact_step: contactResult.contact_step,
        outlet_options: [],
      };
    }

    return {
      reply: getStageReply('outlet'),
      collected: session.collected,
      ready_to_submit: false,
      stage: 'outlet',
      needs_guest_contact: false,
      outlet_options: formatOutletOptions(outlets),
    };
  }

  let extracted = {};
  try {
    extracted = await extractComplaintEntities(
      `${conversationText}\ncustomer: ${userMessage}`,
      session.collected,
      stageBefore,
    );
  } catch (err) {
    console.warn('AI extraction fallback:', err.message);
  }

  const collected = { ...session.collected };
  const trimmed = userMessage.trim();
  const isCommand =
    isComplaintTrigger(trimmed) || isSubmitCommand(trimmed) || isPhotoSkip(trimmed);

  if (!collected.outlet_name && extracted.outlet_name) {
    const matched = parseOutletChoice(extracted.outlet_name, outlets);
    if (matched) {
      collected.outlet_name = matched.outlet_name;
      collected.outlet_id = matched.outlet_id;
    }
  }

  if (stageBefore === 'outlet' && !collected.outlet_name && trimmed.length >= 2 && !isCommand) {
    const matched = parseOutletChoice(trimmed, outlets);
    if (matched) {
      collected.outlet_name = matched.outlet_name;
      collected.outlet_id = matched.outlet_id;
    }
  }

  if (stageBefore === 'order_id' && !collected.order_id && trimmed.length >= 2 && !isCommand) {
    const orderId = validateOrderId(trimmed);
    if (orderId) collected.order_id = orderId;
  }

  if (stageBefore === 'description' && !collected.description && trimmed.length >= 5 && !isCommand) {
    collected.description = trimmed;
  } else if (
    !collected.description &&
    extracted.description &&
    stageBefore !== 'outlet' &&
    stageBefore !== 'order_id'
  ) {
    collected.description = extracted.description.trim();
  }

  if (extracted.priority) collected.priority = extracted.priority;

  session.collected = collected;

  const finalStage = getCurrentStage(session.collected, session);

  if (finalStage === 'photo') {
    session.photoPromptShown = true;
  }

  let reply = getStageReply(finalStage, session.collected);

  if (stageBefore === 'outlet' && !session.collected.outlet_name) {
    if (!outlets.length) {
      reply =
        'Our outlet list is being updated. Please type the **exact outlet name** you visited, or open **Find Outlets** from the menu to browse locations.';
    } else {
      reply =
        "I couldn't match that to one of our outlets. Please tap an outlet from the list below, or type the exact outlet name.";
    }
  }

  if (stageBefore === 'order_id' && !session.collected.order_id) {
    reply =
      'Please enter a valid **Order ID** or receipt number (at least 2 characters). You can find this on your receipt or order confirmation.';
  }

  const ready_to_submit = finalStage === 'photo' || finalStage === 'ready';

  return {
    reply,
    collected: session.collected,
    ready_to_submit,
    stage: finalStage,
    needs_guest_contact: needsGuestContact(session.collected, session),
    contact_step: getContactStep(session.collected),
    outlet_options: finalStage === 'outlet' ? formatOutletOptions(outlets) : [],
    preview: {
      sentiment: extracted.sentiment,
      priority: extracted.priority,
      ai_summary: extracted.ai_summary,
    },
    analysis: extracted,
  };
}

module.exports = {
  extractComplaintEntities,
  processComplaintChatTurn,
  getOutletsForSession,
};
