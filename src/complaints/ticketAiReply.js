const { GoogleGenerativeAI } = require('@google/generative-ai');
const company = require('../companyKnowledge');
const { CATEGORY_LABELS } = require('./complaintTypes');
const {
  SUMMARY_UNAVAILABLE,
  detectCustomerLanguage,
} = require('./ticketAiSummary');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function firstName(fullName) {
  const name = String(fullName || '').trim();
  if (!name || name === '—') return 'Customer';
  return name.split(/\s+/)[0];
}

function getCustomerLanguage(complaint) {
  const customerMessages = (complaint.messages || [])
    .filter((message) => String(message.sender || '').toLowerCase() === 'customer')
    .map((message) => message.message_text);

  return detectCustomerLanguage([
    complaint.description,
    complaint.message,
    ...customerMessages,
  ]);
}

function getReplyLanguageInstructions(language) {
  if (language === 'ms') {
    return `Language rules (IMPORTANT):
- The customer wrote primarily in Bahasa Melayu / informal Malaysian Malay.
- Write the entire email reply in polite, professional Bahasa Melayu (formal "Anda" is fine; avoid overly stiff legal tone).
- Decode slang/short-form from their message (e.g. "tak sama", "tibe ii") and acknowledge the issue clearly in proper Malay.`;
  }

  if (language === 'mixed') {
    return `Language rules (IMPORTANT):
- The customer wrote in Manglish (mixed Bahasa Melayu and English), possibly with slang or short-form.
- Draft a polite reply in professional Bahasa Melayu with brief English phrases where natural for clarity (bilingual Manglish-style is acceptable).
- Match Malaysian customer-care tone: warm, respectful, and easy to understand.`;
  }

  return `Language rules:
- Detect the customer's language from their description and messages.
- If they wrote in Bahasa Melayu or Manglish, reply in professional Bahasa Melayu (or natural bilingual English/Malay).
- Otherwise reply in clear English.`;
}

function buildReplyPrompt(complaint) {
  const categoryLabel =
    complaint.category_label ||
    CATEGORY_LABELS[complaint.complaint_category || complaint.category] ||
    complaint.complaint_category ||
    'General';

  const customerLanguage = getCustomerLanguage(complaint);

  const summary =
    complaint.ai_summary &&
    complaint.ai_summary.trim() &&
    complaint.ai_summary !== SUMMARY_UNAVAILABLE
      ? complaint.ai_summary.trim()
      : null;

  const sections = [
    `Customer name: ${complaint.customer_name || 'Unknown'}`,
    `Detected customer language: ${customerLanguage}`,
    `Order ID: ${complaint.order_id || 'Not provided'}`,
    `Category: ${categoryLabel}`,
    `Priority: ${complaint.priority || 'Medium'}`,
    `Sentiment: ${complaint.sentiment || 'neutral'}`,
    `Ticket status: ${complaint.status_label || complaint.status || 'pending'}`,
    `Outlet: ${complaint.outlet_name || 'Not specified'}`,
    `Description: ${complaint.description || complaint.message || 'No description provided.'}`,
  ];

  if (summary) sections.push(`AI summary (English, for your reference): ${summary}`);

  if (complaint.messages?.length) {
    const transcript = complaint.messages
      .slice(-6)
      .map((m) => `${m.sender}: ${m.message_text}`)
      .join('\n');
    sections.push(`Recent messages:\n${transcript}`);
  }

  return `You are a senior customer care specialist for ${company.companyName} Malaysia.

Write a professional, empathetic email reply to the customer about their support ticket.

${getReplyLanguageInstructions(customerLanguage)}

Guidelines:
- Address the customer by first name (${firstName(complaint.customer_name)})
- Acknowledge their specific issue and show empathy — use their own wording where helpful after normalizing slang
- Apologise sincerely for the inconvenience without admitting legal liability
- Offer a clear, realistic next step (review, investigation, refund/credit consideration, or follow-up call)
- Match tone to sentiment (more urgent apology if frustrated/urgent)
- Use 3–5 short paragraphs; plain text only
- Do NOT include a subject line, email headers, or markdown
- Do NOT use placeholders like [Your Name] or [Company]
- End with this sign-off exactly:
Warm regards,
${company.companyName} Customer Care Team

Ticket details:
${sections.join('\n')}

Return ONLY the email body text.`;
}

function buildFallbackReply(complaint) {
  const name = firstName(complaint.customer_name);
  const categoryLabel =
    complaint.category_label ||
    CATEGORY_LABELS[complaint.complaint_category || complaint.category] ||
    'your recent order';
  const language = getCustomerLanguage(complaint);

  if (language === 'ms' || language === 'mixed') {
    return `Assalamualaikum / Hai ${name},

Terima kasih kerana menghubungi ${company.companyName} berkenaan isu ${categoryLabel}. Kami memohon maaf atas kesulitan yang anda alami dan faham perasaan anda.

Pasukan kami sedang menyemak tiket anda${complaint.order_id ? ` (No. Pesanan: ${complaint.order_id})` : ''} dan akan memberi maklum balas secepat mungkin. Kami akan cuba selesaikan isu ini dengan adil dan pantas.

Jika anda ada maklumat atau gambar tambahan, sila balas e-mel ini supaya kami boleh sertakan dalam semakan.

Warm regards,
${company.companyName} Customer Care Team`;
  }

  return `Dear ${name},

Thank you for reaching out to ${company.companyName} regarding your ${categoryLabel} concern. We are sorry to hear about your experience, and we understand how frustrating this must be.

We have reviewed your ticket and our team is looking into the details of your order${complaint.order_id ? ` (${complaint.order_id})` : ''}. We will follow up with you as soon as we have an update, and we will do our best to resolve this promptly.

If you have any additional information or photos that may help our investigation, please reply to this email and we will add them to your case.

Warm regards,
${company.companyName} Customer Care Team`;
}

/**
 * Generate an empathetic admin email reply draft for a complaint ticket.
 * @param {Object} complaint — formatted complaint from complaintService
 * @returns {Promise<{ message_text: string, source: 'gemini'|'fallback' }>}
 */
async function generateTicketEmailReply(complaint) {
  if (!complaint) {
    throw new Error('Complaint is required.');
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not configured — using fallback email draft.');
    return { message_text: buildFallbackReply(complaint), source: 'fallback' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 1024,
      },
    });

    const result = await model.generateContent(buildReplyPrompt(complaint));
    const text = String(result.response.text() || '').trim();

    if (!text) {
      return { message_text: buildFallbackReply(complaint), source: 'fallback' };
    }

    return { message_text: text, source: 'gemini' };
  } catch (err) {
    console.warn('Ticket AI reply draft failed:', err.message);
    return { message_text: buildFallbackReply(complaint), source: 'fallback' };
  }
}

module.exports = {
  generateTicketEmailReply,
  buildFallbackReply,
};
