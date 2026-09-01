const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const SUMMARY_UNAVAILABLE = 'Summary unavailable';
/** Short Manglish/BM complaints may use fewer words — still send to Gemini. */
const MIN_WORD_COUNT = 2;
const MIN_CHAR_COUNT = 8;

const VALID_SENTIMENTS = ['positive', 'neutral', 'frustrated', 'urgent'];

const MALAY_MARKERS =
  /\b(saya|kami|tak|takde|tidak|dengan|yang|pun|lah|la|je|nak|nk|tibe|sama|sampai|dapat|tiada|kenapa|macam|betul|salah|pesanan|makan|minum|dan|atau|ini|itu|sudah|dah|belum|sangat|terima|kasih|maaf|tak\s+sama|tibe\s+ii)\b/gi;

const ENGLISH_MARKERS =
  /\b(the|and|was|were|my|your|please|thank|sorry|wrong|order|received|instead|instead of)\b/gi;

const SENTIMENT_ALIASES = {
  angry: 'frustrated',
  negative: 'frustrated',
  upset: 'frustrated',
  mad: 'frustrated',
  hostile: 'urgent',
  emergency: 'urgent',
  critical: 'urgent',
  happy: 'positive',
  satisfied: 'positive',
};

function countWords(text) {
  if (!text?.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Extract raw customer-authored text for language detection and fallbacks.
 * @param {Object} input
 */
function getCustomerSourceText(input = {}) {
  const { description, chatTranscript, chatMessages } = input;

  if (description?.trim()) return description.trim();

  const customerLines = (chatMessages || [])
    .filter((message) => {
      const sender = String(message.sender || message.role || '').toLowerCase();
      return sender === 'customer' || sender === 'user';
    })
    .map((message) => message.message_text || message.text || '')
    .join(' ')
    .trim();

  if (customerLines) return customerLines;
  if (chatTranscript?.trim()) return chatTranscript.trim();
  return '';
}

/**
 * @returns {'ms'|'en'|'mixed'}
 */
function detectCustomerLanguage(texts = []) {
  const text = texts.filter(Boolean).join(' ').toLowerCase();
  if (!text.trim()) return 'en';

  const malayHits = (text.match(MALAY_MARKERS) || []).length;
  const englishHits = (text.match(ENGLISH_MARKERS) || []).length;
  const words = countWords(text);
  const malayRatio = words > 0 ? malayHits / words : 0;

  if (malayHits >= 2 || malayRatio >= 0.12) {
    if (englishHits >= 2 && malayHits >= 2) return 'mixed';
    return 'ms';
  }

  return 'en';
}

function hasAnalyzableContent(input = {}) {
  const customerText = getCustomerSourceText(input);
  const analysisText = buildAnalysisInput(input).analysisText;
  const text = customerText || analysisText;
  const words = countWords(text);
  const chars = text.replace(/\s/g, '').length;
  return words >= MIN_WORD_COUNT || chars >= MIN_CHAR_COUNT;
}

function buildFallbackSummary(input = {}) {
  const source = getCustomerSourceText(input);
  if (!source) {
    return {
      ai_summary: SUMMARY_UNAVAILABLE,
      sentiment: 'neutral',
    };
  }

  const truncated = source.length > 220 ? `${source.slice(0, 217)}...` : source;
  return {
    ai_summary: `Customer reported: ${truncated}`,
    sentiment: 'neutral',
  };
}

function normalizeSentiment(value) {
  const raw = String(value || 'neutral').trim().toLowerCase();
  const mapped = SENTIMENT_ALIASES[raw] || raw;
  return VALID_SENTIMENTS.includes(mapped) ? mapped : 'neutral';
}

/**
 * @param {Array<{ sender?: string, role?: string, message_text?: string, text?: string }>} messages
 */
function buildChatTranscript(messages = []) {
  return messages
    .map((message) => {
      const sender = message.sender || message.role || 'customer';
      const text = message.message_text || message.text || '';
      return `${sender}: ${text}`.trim();
    })
    .filter((line) => line.length > 2)
    .join('\n');
}

function buildAnalysisInput({ description, chatTranscript, chatMessages, orderId, customerName, category }) {
  const transcript =
    chatTranscript?.trim() ||
    buildChatTranscript(chatMessages || []);

  const sections = [];
  if (customerName) sections.push(`Customer: ${customerName}`);
  if (orderId) sections.push(`Order ID: ${orderId}`);
  if (category) sections.push(`Category: ${category}`);
  if (description?.trim()) sections.push(`Description: ${description.trim()}`);
  if (transcript) sections.push(`Chat transcript:\n${transcript}`);

  return {
    analysisText: sections.join('\n'),
    transcript,
  };
}

function parseJsonResponse(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI did not return valid JSON.');
  return JSON.parse(match[0]);
}

function buildSummaryPrompt(analysisText, customerLanguage = 'en') {
  const languageHint =
    customerLanguage === 'ms'
      ? 'The customer wrote primarily in Bahasa Melayu / informal Malaysian Malay.'
      : customerLanguage === 'mixed'
        ? 'The customer wrote in Manglish (mixed Bahasa Melayu and English), possibly with slang or short-form (e.g. "tak sama", "tibe ii").'
        : 'The customer may have written in any language.';

  return `You are an internal support analyst for US Pizza Malaysia.

${languageHint}

Multilingual rules (IMPORTANT):
- Process complaint text in ANY language: Bahasa Melayu, English, Manglish, or informal Malaysian slang/short-form.
- Decode informal spelling and abbreviations (e.g. "tak sama" = not the same/wrong, "tibe ii" = suddenly/instead, "dpt" = received).
- Always write "ai_summary" in clear, professional English for admin staff — translate and normalize the issue even if the input is very informal or mixed language.
- Do NOT refuse, skip, or return empty output because the input is not in English.
- Infer the core issue (wrong item, late delivery, quality, etc.) from context when wording is casual or incomplete.

Example:
Input: "order tak sama dengan apa saya dapat .. saya order aloha tibe ii sampai fish n chip."
Output ai_summary: "Customer received the wrong item (Fish & Chips instead of Aloha Pizza)."

Analyze the customer complaint below and respond ONLY with valid JSON (no markdown):
{
  "ai_summary": "1-2 concise sentences summarizing the core issue and what the customer wants done",
  "sentiment": "positive|neutral|frustrated|urgent"
}

Sentiment rules:
- positive: satisfied tone or minor feedback
- neutral: factual complaint with no strong emotion
- frustrated: annoyed or disappointed but not an emergency
- urgent: angry, threatening, food safety concerns, repeated failures, or demands immediate action

Complaint content:
${analysisText}`;
}

/**
 * Generate AI summary + sentiment for a support ticket.
 * @param {Object} input
 * @param {string} [input.description]
 * @param {string} [input.chatTranscript]
 * @param {Array} [input.chatMessages]
 * @param {string} [input.orderId]
 * @param {string} [input.customerName]
 * @param {string} [input.category]
 */
async function generateTicketAiSummary(input = {}) {
  const { analysisText, transcript } = buildAnalysisInput(input);
  const customerLanguage = detectCustomerLanguage([
    getCustomerSourceText(input),
    input.description,
    input.chatTranscript,
  ]);

  if (!hasAnalyzableContent(input)) {
    return {
      ai_summary: SUMMARY_UNAVAILABLE,
      sentiment: 'neutral',
      chat_transcript: transcript || null,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not configured — using fallback summary.');
    const fallback = buildFallbackSummary(input);
    return {
      ...fallback,
      chat_transcript: transcript || null,
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent(buildSummaryPrompt(analysisText, customerLanguage));
    const parsed = parseJsonResponse(result.response.text());
    const aiSummary = String(parsed.ai_summary || '').trim();

    if (!aiSummary) {
      const fallback = buildFallbackSummary(input);
      return {
        ...fallback,
        chat_transcript: transcript || null,
      };
    }

    return {
      ai_summary: aiSummary,
      sentiment: normalizeSentiment(parsed.sentiment),
      chat_transcript: transcript || null,
    };
  } catch (err) {
    console.warn('Ticket AI summary failed:', err.message);
    const fallback = buildFallbackSummary(input);
    return {
      ...fallback,
      chat_transcript: transcript || null,
    };
  }
}

module.exports = {
  SUMMARY_UNAVAILABLE,
  VALID_SENTIMENTS,
  MIN_WORD_COUNT,
  MIN_CHAR_COUNT,
  countWords,
  normalizeSentiment,
  buildChatTranscript,
  getCustomerSourceText,
  detectCustomerLanguage,
  hasAnalyzableContent,
  buildFallbackSummary,
  generateTicketAiSummary,
};
