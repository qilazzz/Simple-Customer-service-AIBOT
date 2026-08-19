const knowledge = require('../../src/companyKnowledge');

function buildGeminiSystemInstruction() {
  const k = knowledge;
  const contact = `${k.contactPerson.name} at ${k.contactPerson.phone}`;
  const outOfScopeReply = `Sorry, I can only help with questions about ${k.companyName} (menu, services, hours, delivery, orders, etc.). For anything else, please contact ${contact}.`;

  const allPizzas = [
    ...k.menu.pizzas.traditional,
    ...k.menu.pizzas.signature,
    ...k.menu.pizzas.chefsBest,
  ];
  return `You are a friendly customer service assistant for "${k.companyName}". Be warm and conversational.

About: ${k.about}
Orders: ${k.phoneNumber}
Services: ${k.services.join('; ')}
Outlets: use GET /api/outlets for the latest outlet list from the database.
Pizzas: ${allPizzas.join(', ')}
Sides: ${k.menu.sides.join(', ')}
Hours: weekdays ${k.operatingHours.weekdays}, weekends ${k.operatingHours.weekends}
Delivery: ${k.delivery.areas}, min ${k.delivery.minimumOrder}, fee ${k.delivery.deliveryFee}
Payment: ${k.paymentMethods.join(', ')}
FAQ: ${k.faq.map((f) => `${f.q} → ${f.a}`).join(' | ')}

Rules:
- Answer ${k.companyName} questions helpfully from the info above. Recommend specific menu items when asked.
- For "closest/near me" → suggest the app's Find Outlets section or Google Maps/Waze for US Pizza Malaysia.
- Missing details → share what you know, then mention ${contact}.
- Unrelated topics (weather, homework, coding) → reply EXACTLY: ${outOfScopeReply}
- Keep replies concise. Don't invent prices or addresses not listed.`;
}

const hoursResponse = `🕐 ${knowledge.companyName} operating hours:
• Weekdays: ${knowledge.operatingHours.weekdays}
• Weekends: ${knowledge.operatingHours.weekends}

${knowledge.operatingHours.note}`;

const greetingResponse = `Hello! 👋 Welcome to ${knowledge.companyName}. I can help with our menu, services, hours, delivery, and orders. What would you like to know?`;

const menuResponse = `🍕 Our menu at ${knowledge.companyName}:

*Traditional:*
${knowledge.menu.pizzas.traditional.map((p) => `• ${p}`).join('\n')}

*Signature:*
${knowledge.menu.pizzas.signature.map((p) => `• ${p}`).join('\n')}

*Sides:*
${knowledge.menu.sides.map((s) => `• ${s}`).join('\n')}

*Drinks:*
${knowledge.menu.drinks.map((d) => `• ${d}`).join('\n')}`;

/**
 * @param {import('knex').Knex} knex
 */
exports.seed = async function seed(knex) {
  await knex('bot_commands').del();
  await knex('ai_configurations').del();

  await knex('ai_configurations').insert([
    {
      config_key: 'gemini_system_instruction',
      config_value: buildGeminiSystemInstruction(),
    },
    {
      config_key: 'gemini_model',
      config_value: 'gemini-2.5-flash',
    },
    {
      config_key: 'gemini_temperature',
      config_value: '0.7',
    },
    {
      config_key: 'gemini_max_output_tokens',
      config_value: '512',
    },
  ]);

  await knex('bot_commands').insert([
    {
      intent_name: 'greeting',
      keywords: JSON.stringify({
        matchMode: 'starts',
        list: [
          'hi',
          'hello',
          'hey',
          'salam',
          'assalam',
          'assalamualaikum',
          'good morning',
          'good afternoon',
          'good evening',
        ],
      }),
      response_type: 'text',
      response_payload: greetingResponse,
      action_handler: null,
      is_active: true,
    },
    {
      intent_name: 'hours',
      keywords: JSON.stringify({
        matchMode: 'keyword',
        list: [
          'hours',
          'opening hours',
          'operating hours',
          'what time do you open',
          'when do you open',
          'business hours',
          'closing time',
          'close time',
          'when do you close',
          'what time do you close',
          'what is your closing time',
          'what are your hours',
        ],
      }),
      response_type: 'text',
      response_payload: hoursResponse,
      action_handler: null,
      is_active: true,
    },
    {
      intent_name: 'menu',
      keywords: JSON.stringify({
        matchMode: 'exact',
        list: [
          'menu',
          'show menu',
          'full menu',
          'menu list',
          "what's the menu",
          'what is the menu',
          'what is on the menu',
        ],
      }),
      response_type: 'text',
      response_payload: menuResponse,
      action_handler: null,
      is_active: true,
    },
    {
      intent_name: 'promotions',
      keywords: JSON.stringify({
        matchMode: 'exact',
        list: ['promo', 'promos', 'promotion', 'promotions', 'deals'],
      }),
      response_type: 'action_api',
      response_payload: null,
      action_handler: 'getPromotions',
      is_active: true,
    },
    {
      intent_name: 'order_status',
      keywords: JSON.stringify({
        matchMode: 'keyword',
        list: ['order status', 'track order', 'where is my order', 'check order'],
      }),
      response_type: 'action_api',
      response_payload: null,
      action_handler: 'checkOrderStatus',
      is_active: true,
    },
  ]);
};
