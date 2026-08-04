const knowledge = require('./companyKnowledge');

/** Questions that need AI reasoning when Gemini is available */
function isAiQuestion(text) {
  const q = text.toLowerCase();
  return /\b(should|recommend|suggest|best|good for|which one|which outlet|what pizza|help me choose|pick for me|closest|nearest|near me|nearby|where should i|what should i)\b/.test(
    q,
  );
}

function matchIntent(text, { relaxed = false } = {}) {
  const q = text.toLowerCase().trim();

  if (!relaxed && isAiQuestion(q)) return null;

  if (/^(hi|hello|hey|salam|assalamu?alaikum|good morning|good afternoon|good evening)[\s!.?]*$/i.test(q)) {
    return 'greeting';
  }

  if (/^(menu|show menu|full menu|menu list)[\s!.?]*$/i.test(q) || /\bwhat('s| is) (on )?(the |your )?menu\b/.test(q)) {
    return 'menu';
  }

  if (
    /^(hours|opening hours|operating hours)[\s!.?]*$/i.test(q) ||
    /\b(what time (do you|are you) open|when (do you|are you) open|business hours|closing time|close time|when (do you|are you) close|what time (do you|are you) close)\b/.test(q)
  ) {
    if (/\bclosest\b/.test(q)) return relaxed ? 'location' : null;
    return 'hours';
  }

  if (/^(outlets|outlet|locations|branches|stores)[\s!.?]*$/i.test(q) || /\b(outlet|branch|location|address(es)?)\b/.test(q)) {
    return 'outlets';
  }

  if (/\b(closest|nearest|near me|nearby)\b/.test(q)) {
    return 'location';
  }

  if (/^(recommendation|recommendations|suggest|suggestion)[\s!.?]*$/i.test(q) || /\b(recommend|what('s| is) popular|best seller)\b/.test(q)) {
    return 'recommendation';
  }

  if (/^(services|our services|what services)[\s!.?]*$/i.test(q) || /\bwhat (services|do you offer)\b/.test(q)) {
    return 'services';
  }

  if (/^(delivery|delivery info)[\s!.?]*$/i.test(q) || /\b(do you deliver|delivery area|minimum order)\b/.test(q)) {
    return 'delivery';
  }

  if (/^(contact|phone number|phone)[\s!.?]*$/i.test(q) || /\b(how (to|can i) (reach|contact)|whatsapp number)\b/.test(q)) {
    return 'contact';
  }

  if (/^(payment|payments|pay)[\s!.?]*$/i.test(q) || /\b(payment methods|how (to|can i) pay)\b/.test(q)) {
    return 'payment';
  }

  if (/^(promo|promos|promotion|promotions|deals)[\s!.?]*$/i.test(q)) {
    return 'promotions';
  }

  return null;
}

function replyForIntent(intent) {
  const k = knowledge;

  switch (intent) {
    case 'greeting':
      return `Hello! 👋 Welcome to ${k.companyName}. I can help with our menu, services, hours, delivery, and orders. What would you like to know?`;

    case 'services':
      return `Here are our services at ${k.companyName}:\n\n${k.services.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nOrder via WhatsApp: ${k.whatsappNumber}`;

    case 'menu':
      return `🍕 Our menu at ${k.companyName}:\n\n*Pizzas:*\n${k.menu.pizzas.map((p) => `• ${p}`).join('\n')}\n\n*Sides:*\n${k.menu.sides.map((s) => `• ${s}`).join('\n')}\n\n*Drinks:*\n${k.menu.drinks.map((d) => `• ${d}`).join('\n')}`;

    case 'hours':
      return `🕐 ${k.companyName} operating hours:\n• Weekdays: ${k.operatingHours.weekdays}\n• Weekends: ${k.operatingHours.weekends}\n\n${k.operatingHours.note}`;

    case 'outlets':
      return `📍 ${k.companyName} outlets (Taman Bukit Permai, Kajang):\n\n${k.outlets.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\nSearch "US Pizza Kajang" on Google Maps or Waze for directions.`;

    case 'location':
      return `I can't see your location on WhatsApp 😅\n\nSearch *US Pizza Kajang* on Google Maps or Waze to find the nearest outlet.\n\nAll our outlets are in Taman Bukit Permai, Kajang, Selangor.`;

    case 'recommendation':
      return `🍕 Popular picks at ${k.companyName}:\n• *Meat Lovers* — if you love meat\n• *Super Supreme* — loaded toppings\n• *Classic Pepperoni* — all-time favourite\n• *Vegetarian Delight* — veggie option\n\nOrder via WhatsApp: ${k.whatsappNumber}`;

    case 'delivery':
      return `🛵 Delivery info:\n• Areas: ${k.delivery.areas}\n• Minimum order: ${k.delivery.minimumOrder}\n• Fee: ${k.delivery.deliveryFee}\n• ETA: ${k.delivery.estimatedTime}`;

    case 'contact':
      return `📞 Contact ${k.companyName}:\n• WhatsApp/Orders: ${k.whatsappNumber}\n• For other enquiries: ${k.contactPerson.name} — ${k.contactPerson.phone}`;

    case 'payment':
      return `💳 We accept: ${k.paymentMethods.join(', ')}`;

    case 'promotions':
      return k.promotions;

    default:
      return null;
  }
}

function wrapLocalReply(text, intent, reason) {
  return {
    text: replyForIntent(intent),
    source: 'local',
    intent,
    reason,
  };
}

function getLocalReply(text) {
  const intent = matchIntent(text);
  if (!intent) return null;
  return replyForIntent(intent);
}

function tryLocalReply(text) {
  const intent = matchIntent(text);
  if (!intent) return null;
  return wrapLocalReply(text, intent, 'matched_intent');
}

/** Broader matching when Gemini is down (quota / offline) */
function tryOfflineReply(text) {
  const strict = tryLocalReply(text);
  if (strict) return { ...strict, reason: 'gemini_down' };

  const intent = matchIntent(text, { relaxed: true });
  if (!intent) return null;

  return wrapLocalReply(text, intent, 'gemini_down');
}

module.exports = { getLocalReply, tryLocalReply, tryOfflineReply, matchIntent, isAiQuestion };
