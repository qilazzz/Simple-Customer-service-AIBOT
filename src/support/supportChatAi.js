const { GoogleGenerativeAI } = require('@google/generative-ai');
const company = require('../companyKnowledge');
const { parseMenuChoice } = require('./supportMenu');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const VALID_INTENTS = [
  'general',
  'find_outlet',
  'order_status',
  'order_issue',
  'menu',
  'promotions',
  'other',
];

const SYSTEM_PROMPT = `You are a warm, helpful customer service assistant for US Pizza Malaysia.

Answer naturally in 1–3 short sentences. Be polite and conversational for greetings and small talk.

When the customer needs a specific service, set "intent" to route them:
- find_outlet — locations, branches, nearest outlet, address
- order_status — track order, where is my pizza/order, delivery status
- order_issue — complaint, wrong order, late delivery, bad food, refund, problem
- menu — food menu, pizzas, sides, what to order, sizes, crust
- promotions — deals, discounts, vouchers, offers
- other — speak to human support, general help not covered above
- general — greetings, thanks, goodbye, chitchat, or unclear questions (stay conversational)

Company facts (use when relevant, do not invent prices):
- Phone: ${company.phoneNumber}
- About: ${company.about}
- Delivery: ${company.delivery.estimatedTime} typical, min order ${company.delivery.minimumOrder}
- Hours: weekdays ${company.operatingHours.weekdays}, weekends ${company.operatingHours.weekends}

Respond ONLY with valid JSON (no markdown fences):
{"reply":"your natural customer-facing message","intent":"general|find_outlet|order_status|order_issue|menu|promotions|other"}`;

function parseJsonResponse(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI did not return valid JSON.');
  return JSON.parse(match[0]);
}

function buildConversationPrompt(messages, latestMessage) {
  const history = messages
    .slice(-10)
    .map((m) => `${m.role === 'customer' ? 'Customer' : 'Assistant'}: ${m.text}`)
    .join('\n');

  return `${SYSTEM_PROMPT}

Recent conversation:
${history || '(new conversation)'}

Latest customer message: ${latestMessage}

Analyze the latest message and respond with JSON.`;
}

function detectLocalIntent(text) {
  return parseMenuChoice(text);
}

function getLocalConversationalReply(text) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  const routedIntent = detectLocalIntent(trimmed);
  if (routedIntent) {
    return { reply: null, intent: routedIntent };
  }

  if (/good\s*(morning|afternoon|evening|night)|goodnight|good night/.test(lower)) {
    let greeting = 'Hello';
    if (/morning/.test(lower)) greeting = 'Good morning';
    else if (/afternoon/.test(lower)) greeting = 'Good afternoon';
    else if (/evening|night|goodnight/.test(lower)) greeting = 'Good evening';

    return {
      reply: `${greeting}! How can I assist you with your US Pizza order tonight?`,
      intent: 'general',
    };
  }

  if (/^(hi+|hello+|hey+|halo+|yo+)\b|^(salam|assalam)/.test(lower)) {
    return {
      reply: 'Hello! Welcome to US Pizza Malaysia. How can I help you today?',
      intent: 'general',
    };
  }

  if (/\b(thank you|thanks|terima kasih)\b/.test(lower)) {
    return {
      reply: "You're welcome! Let me know if there's anything else I can help with.",
      intent: 'general',
    };
  }

  if (/\b(bye|goodbye|see you|take care)\b/.test(lower)) {
    return {
      reply: 'Thank you for reaching out to US Pizza. Have a wonderful day!',
      intent: 'general',
    };
  }

  if (/\bwhere is my (pizza|order)|track my order|order status\b/.test(lower)) {
    return {
      reply: 'I can help you track your order. Please share your Order ID or receipt number.',
      intent: 'order_status',
    };
  }

  return {
    reply:
      "I'm here to help with orders, menu, outlets, promotions, and support. Feel free to ask, or tap an option below.",
    intent: 'general',
  };
}

/**
 * @param {string} userMessage
 * @param {Array<{role: string, text: string}>} [messages]
 * @returns {Promise<{ reply: string|null, intent: string }>}
 */
async function processSupportChatMessage(userMessage, messages = []) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return getLocalConversationalReply(userMessage);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      generationConfig: { temperature: 0.65, maxOutputTokens: 320 },
    });

    const result = await model.generateContent(
      buildConversationPrompt(messages, userMessage),
    );
    const parsed = parseJsonResponse(result.response.text());

    const intent = VALID_INTENTS.includes(parsed.intent) ? parsed.intent : 'general';
    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : null;

    if (intent !== 'general' && !reply) {
      return { reply: null, intent };
    }

    return {
      reply: reply || getLocalConversationalReply(userMessage).reply,
      intent,
    };
  } catch (err) {
    console.error('Support chat AI fallback:', err.message);
    return getLocalConversationalReply(userMessage);
  }
}

module.exports = {
  processSupportChatMessage,
  getLocalConversationalReply,
  VALID_INTENTS,
};
