/**
 * US Pizza company information.
 * Edit this file to match your actual business details.
 */
module.exports = {
  companyName: 'US Pizza',
  whatsappNumber: '01X-XXX-XXXX', // Your WhatsApp business line (display only — actual bot = phone that scans QR)
  contactPerson: {
    name: 'Support Team',
    phone: '01X-XXX-XXXX', // Human contact for out-of-scope / complex issues
  },

  about:
    'US Pizza is a pizza restaurant offering fresh handmade pizzas, sides, and beverages. We serve customers through dine-in, takeaway, and delivery.',

  services: [
    'Dine-in — enjoy fresh pizza at our outlet',
    'Takeaway — order and pick up at the counter',
    'Delivery — pizza delivered to your doorstep (within delivery area)',
    'Catering — pizza catering for events and parties (advance booking required)',
    'Online ordering — order via WhatsApp or phone',
  ],

  outlets: [
    'No. 1, Jalan 1/1, Taman Bukit Permai, 43000 Kajang, Selangor',
    'No. 2, Jalan 2/2, Taman Bukit Permai, 43000 Kajang, Selangor',
    'No. 3, Jalan 3/3, Taman Bukit Permai, 43000 Kajang, Selangor',
    'No. 4, Jalan 4/4, Taman Bukit Permai, 43000 Kajang, Selangor',
    'No. 5, Jalan 5/5, Taman Bukit Permai, 43000 Kajang, Selangor',
    'No. 6, Jalan 6/6, Taman Bukit Permai, 43000 Kajang, Selangor',
    'No. 7, Jalan 7/7, Taman Bukit Permai, 43000 Kajang, Selangor',
    'No. 8, Jalan 8/8, Taman Bukit Permai, 43000 Kajang, Selangor',
    'No. 9, Jalan 9/9, Taman Bukit Permai, 43000 Kajang, Selangor',
    'No. 10, Jalan 10/10, Taman Bukit Permai, 43000 Kajang, Selangor',
  ],

  menu: {
    pizzas: [
      'Classic Pepperoni',
      'Hawaiian',
      'Super Supreme',
      'BBQ Chicken',
      'Vegetarian Delight',
      'Cheese Lovers',
      'Meat Lovers',
      'Custom pizza (choose your own toppings)',
    ],
    sides: ['Garlic bread', 'Chicken wings', 'French fries', 'Mozzarella sticks'],
    drinks: ['Soft drinks', 'Mineral water', 'Fresh juice (selected outlets)'],
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
      a: 'Message us on WhatsApp or call our order line. Check companyKnowledge.js for the number.',
    },
  ],
};
