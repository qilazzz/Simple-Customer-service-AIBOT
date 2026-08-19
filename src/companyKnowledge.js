/**
 * US Pizza company information.
 * Edit this file to match your actual business details.
 */
module.exports = {
  companyName: 'US Pizza',
  phoneNumber: '013 667 9056',
  contactPerson: {
    name: 'Qila',
    phone: '013 242 9974',
  },

  about:
    'US Pizza is a pizza restaurant offering fresh handmade pizzas, sides, and beverages. We serve customers through dine-in, takeaway, and delivery.',

  services: [
    'Dine-in — enjoy fresh pizza at our outlet',
    'Takeaway — order and pick up at the counter',
    'Delivery — pizza delivered to your doorstep (within delivery area)',
    'Catering — pizza catering for events and parties (advance booking required)',
    'Online ordering — call us or use the mobile app',
  ],

  menu: {
    fullMenuUrl: '/menu.html',
    pizzas: {
      traditional: [
        'Classic Pepperoni',
        'Hawaiian',
        'Cheese Lovers',
        'Vegetarian Delight',
      ],
      signature: [
        'Super Supreme',
        'BBQ Chicken',
        'Seafood Delight',
        'Spicy Chicken Ranch',
      ],
      chefsBest: [
        'Meat Lovers',
        'US Pizza Special',
        'Truffle Mushroom',
        'Custom pizza (choose your own toppings)',
      ],
    },
    sides: [
      'Garlic bread',
      'Cheesy garlic bread',
      'Chicken wings (6 pcs)',
      'Mozzarella sticks',
      'French fries',
    ],
    pasta: ['Chicken Alfredo pasta', 'Spaghetti Bolognese', 'Creamy mushroom pasta'],
    drinks: ['Soft drinks', 'Mineral water', 'Fresh juice (selected outlets)', 'Iced lemon tea'],
    sizes: [
      { name: 'Personal', size: '6"', serves: '1 person' },
      { name: 'Regular', size: '9"', serves: '1–2 people' },
      { name: 'Large', size: '13"', serves: '3–4 people' },
    ],
    crusts: [
      'Classic Hand Tossed',
      'Thin & Crispy',
      'Garlic Parmesan',
      'Cheese Stuffed Crust (selected outlets)',
    ],
    halal: {
      certified: true,
      summary:
        'US Pizza Malaysia outlets serve Halal-certified food prepared in accordance with Halal guidelines.',
      certificateNote: 'Halal certification is displayed at each outlet. Ask staff if you need details.',
    },
    dietary: {
      vegetarian: [
        'Vegetarian Delight pizza',
        'Custom veggie pizzas with your choice of toppings',
        'Garlic bread and selected sides',
      ],
      notes: [
        'We can customize orders to reduce or omit certain ingredients on request.',
        'Please inform staff of any allergies when ordering.',
      ],
    },
    // Legacy flat lists used elsewhere
    sidesLegacy: ['Garlic bread', 'Chicken wings', 'French fries', 'Mozzarella sticks'],
    drinksLegacy: ['Soft drinks', 'Mineral water', 'Fresh juice (selected outlets)'],
  },

  operatingHours: {
    weekdays: '11:00 AM – 10:00 PM',
    weekends: '11:00 AM – 11:00 PM',
    note: 'Hours may vary on public holidays. Call to confirm.',
  },

  delivery: {
    areas: 'Selected areas within our delivery zone',
    minimumOrder: 'RM 25',
    deliveryFee: 'RM 3–5 depending on distance',
    estimatedTime: '30–45 minutes',
  },

  paymentMethods: ['Cash', 'Online transfer', 'E-wallet (Touch n Go, GrabPay — selected outlets)'],

  promotions:
    'Ask about our current promotions when you order. Deals change regularly — contact us for the latest offers.',

  faq: [
    {
      q: 'Do you have vegetarian options?',
      a: 'Yes. We offer Vegetarian Delight pizza and can customize pizzas with veggie toppings.',
    },
    {
      q: 'Can I customize my pizza?',
      a: 'Yes. You can choose your size, crust, and toppings for a custom pizza.',
    },
    {
      q: 'How do I place an order?',
      a: 'Call us at 013 667 9056 or use Customer Support in the mobile app.',
    },
  ],
};
