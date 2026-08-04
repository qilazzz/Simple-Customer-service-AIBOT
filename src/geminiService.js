const { GoogleGenerativeAI } = require('@google/generative-ai');
const knowledge = require('./companyKnowledge');

const OUT_OF_SCOPE_REPLY = `Sorry, I can only help with questions about ${knowledge.companyName} (menu, services, hours, delivery, orders, etc.).

For anything else, please contact ${knowledge.contactPerson.name} at ${knowledge.contactPerson.phone}.`;

const DEFAULT_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

function buildSystemPrompt() {
  const k = knowledge;
  const contact = `${k.contactPerson.name} at ${k.contactPerson.phone}`;

  return `You are a friendly WhatsApp assistant for "${k.companyName}". Be warm and conversational.

About: ${k.about}
Orders: ${k.whatsappNumber}
Services: ${k.services.join('; ')}
Outlets: ${k.outlets.join('; ')}
Pizzas: ${k.menu.pizzas.join(', ')}
Sides: ${k.menu.sides.join(', ')}
Hours: weekdays ${k.operatingHours.weekdays}, weekends ${k.operatingHours.weekends}
Delivery: ${k.delivery.areas}, min ${k.delivery.minimumOrder}, fee ${k.delivery.deliveryFee}
Payment: ${k.paymentMethods.join(', ')}
FAQ: ${k.faq.map((f) => `${f.q} → ${f.a}`).join(' | ')}

Rules:
- Answer ${k.companyName} questions helpfully from the info above. Recommend specific menu items when asked.
- For "closest/near me" → you can't see their location; suggest Google Maps/Waze "US Pizza Kajang".
- Missing details → share what you know, then mention ${contact}.
- Unrelated topics (weather, homework, coding) → reply EXACTLY: ${OUT_OF_SCOPE_REPLY}
- Short WhatsApp replies. Don't invent prices or addresses not listed.`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaError(err) {
  const msg = err?.message || '';
  return msg.includes('429') || msg.includes('quota') || msg.includes('Quota exceeded');
}

function parseRetrySeconds(err) {
  const match = err?.message?.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (match) return Math.min(Math.ceil(parseFloat(match[1]) + 1), 65);
  return 0;
}

function getModelChain(preferredModel) {
  const chain = [preferredModel || DEFAULT_MODEL, ...FALLBACK_MODELS];
  return [...new Set(chain)];
}

function createGeminiService(apiKey, modelName = DEFAULT_MODEL) {
  const key = apiKey?.trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY is missing. Add it to your .env file.');
  }

  const genAI = new GoogleGenerativeAI(key);
  const modelChain = getModelChain(modelName);
  let activeModel = modelChain[0];

  async function generateWithModel(model, userMessage) {
    const geminiModel = genAI.getGenerativeModel({
      model,
      systemInstruction: buildSystemPrompt(),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
      },
    });

    const result = await geminiModel.generateContent(userMessage);
    const response = result.response;

    if (!response.candidates?.length) {
      throw new Error('Gemini returned no response.');
    }

    try {
      return response.text().trim() || OUT_OF_SCOPE_REPLY;
    } catch {
      throw new Error('Gemini blocked or empty response.');
    }
  }

  async function tryModel(model, userMessage, errors) {
    try {
      const text = await generateWithModel(model, userMessage);
      if (model !== activeModel) {
        console.log(`ℹ️  Switched Gemini model: ${activeModel} → ${model}`);
        activeModel = model;
      }
      return { text, source: 'ai', model };
    } catch (err) {
      errors.push(`${model}: ${err.message.slice(0, 120)}`);

      if (isQuotaError(err)) {
        const waitSec = parseRetrySeconds(err);
        if (waitSec > 0 && waitSec <= 65) {
          console.log(`⏳ Gemini rate limit — retrying ${model} in ${waitSec}s...`);
          await sleep(waitSec * 1000);
          try {
            const text = await generateWithModel(model, userMessage);
            return { text, source: 'ai', model };
          } catch (retryErr) {
            errors.push(`${model} (retry): ${retryErr.message.slice(0, 120)}`);
          }
        }
      } else {
        throw err;
      }
    }

    return null;
  }

  async function getReply(userMessage) {
    const errors = [];

    for (const model of modelChain) {
      const result = await tryModel(model, userMessage, errors);
      if (result) return result;
    }

    const quotaHit = errors.some((e) => e.includes('429') || e.includes('quota'));
    const err = new Error(errors.join(' | '));
    err.quotaExceeded = quotaHit;
    throw err;
  }

  return { getReply, OUT_OF_SCOPE_REPLY, activeModel: () => activeModel };
}

module.exports = { createGeminiService, OUT_OF_SCOPE_REPLY, DEFAULT_MODEL };
