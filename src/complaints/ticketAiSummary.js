const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const SUMMARY_UNAVAILABLE = 'Summary unavailable';
const MIN_WORD_COUNT = 10;

const VALID_SENTIMENTS = ['positive', 'neutral', 'frustrated', 'urgent'];

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

function buildSummaryPrompt(analysisText) {
  return `You are an internal support analyst for US Pizza Malaysia.

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
  const { analysisText } = buildAnalysisInput(input);

  if (countWords(analysisText) < MIN_WORD_COUNT) {
    return {
      ai_summary: SUMMARY_UNAVAILABLE,
      sentiment: 'neutral',
      chat_transcript: buildAnalysisInput(input).transcript || null,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not configured — AI summary skipped.');
    return {
      ai_summary: SUMMARY_UNAVAILABLE,
      sentiment: 'neutral',
      chat_transcript: buildAnalysisInput(input).transcript || null,
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

    const result = await model.generateContent(buildSummaryPrompt(analysisText));
    const parsed = parseJsonResponse(result.response.text());
    const aiSummary = String(parsed.ai_summary || '').trim();

    return {
      ai_summary: aiSummary || SUMMARY_UNAVAILABLE,
      sentiment: normalizeSentiment(parsed.sentiment),
      chat_transcript: buildAnalysisInput(input).transcript || null,
    };
  } catch (err) {
    console.warn('Ticket AI summary failed:', err.message);
    return {
      ai_summary: SUMMARY_UNAVAILABLE,
      sentiment: 'neutral',
      chat_transcript: buildAnalysisInput(input).transcript || null,
    };
  }
}

module.exports = {
  SUMMARY_UNAVAILABLE,
  VALID_SENTIMENTS,
  MIN_WORD_COUNT,
  countWords,
  normalizeSentiment,
  buildChatTranscript,
  generateTicketAiSummary,
};
