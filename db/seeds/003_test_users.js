const crypto = require('crypto');

const SEED_USER_PREFIX = 'test-user-';
const SEED_EMAIL_DOMAIN = '@uspizza-test.local';
const DEFAULT_TEST_PASSWORD = 'Test1234';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function buildContact(email, phone) {
  return phone ? `${email} / ${phone}` : email;
}

async function ensureRiderCategory(knex) {
  await knex.raw(`
    ALTER TABLE complaints
    MODIFY COLUMN complaint_category ENUM(
      'wrong_order',
      'late_delivery',
      'food_quality',
      'service',
      'rider',
      'other'
    ) NOT NULL DEFAULT 'other'
  `).catch(() => {});
}

/** @type {Array<{ user_id: string, name: string, email: string, phone_number: string, complaint: object }>} */
const TEST_USERS = [
  {
    user_id: `${SEED_USER_PREFIX}001`,
    name: 'Amir Hassan',
    email: `amir.hassan${SEED_EMAIL_DOMAIN}`,
    phone_number: '+60123456701',
    complaint: {
      order_id: 'ORD-2026-1001',
      outlet_name: 'US Pizza SS2 Petaling Jaya',
      complaint_category: 'late_delivery',
      status: 'pending',
      priority: 'High',
      sentiment: 'frustrated',
      description:
        'Order ORD-2026-1001 was promised in 45 minutes but arrived after 95 minutes. The pizza was lukewarm on arrival.',
      ai_summary:
        'Customer reports a late delivery exceeding the promised window; food arrived cold and they want a refund or redelivery.',
    },
  },
  {
    user_id: `${SEED_USER_PREFIX}002`,
    name: 'Siti Aminah',
    email: `siti.aminah${SEED_EMAIL_DOMAIN}`,
    phone_number: '+60123456702',
    complaint: {
      order_id: 'ORD-2026-1002',
      outlet_name: 'US Pizza Subang Jaya',
      complaint_category: 'wrong_order',
      status: 'in_progress',
      priority: 'Medium',
      sentiment: 'frustrated',
      description:
        'I ordered a Hawaiian pizza but received a Meat Lovers instead. My receipt shows the correct item.',
      ai_summary:
        'Wrong pizza item delivered compared to the receipt; customer expects a replacement or refund.',
    },
  },
  {
    user_id: `${SEED_USER_PREFIX}003`,
    name: 'Raj Kumar',
    email: `raj.kumar${SEED_EMAIL_DOMAIN}`,
    phone_number: '+60123456703',
    complaint: {
      order_id: 'ORD-2026-1003',
      outlet_name: 'US Pizza Shah Alam',
      complaint_category: 'food_quality',
      status: 'resolved',
      priority: 'Medium',
      sentiment: 'neutral',
      description:
        'The crust on both pizzas was undercooked and doughy in the centre. This is the second time this month.',
      ai_summary:
        'Repeat complaint about undercooked pizza crust; customer wants quality assurance at the outlet.',
    },
  },
  {
    user_id: `${SEED_USER_PREFIX}004`,
    name: 'Lim Wei Jie',
    email: `lim.weijie${SEED_EMAIL_DOMAIN}`,
    phone_number: '+60123456704',
    complaint: {
      order_id: 'ORD-2026-1004',
      outlet_name: 'US Pizza Bangsar',
      complaint_category: 'service',
      status: 'pending',
      priority: 'Low',
      sentiment: 'neutral',
      description:
        'Called the outlet twice to check on a pickup order and was put on hold for over 10 minutes each time.',
      ai_summary:
        'Customer experienced long hold times when calling the outlet about a pickup order.',
    },
  },
  {
    user_id: `${SEED_USER_PREFIX}005`,
    name: 'Nurul Izzati',
    email: `nurul.izzati${SEED_EMAIL_DOMAIN}`,
    phone_number: '+60123456705',
    complaint: {
      order_id: 'ORD-2026-1005',
      outlet_name: 'US Pizza Penang Georgetown',
      complaint_category: 'rider',
      status: 'in_progress',
      priority: 'High',
      sentiment: 'urgent',
      description:
        'The delivery rider was rude and refused to hand over the order until I paid an extra RM5 cash fee not shown in the app.',
      ai_summary:
        'Customer alleges the rider demanded an unauthorised cash fee and behaved aggressively at delivery.',
    },
  },
  {
    user_id: `${SEED_USER_PREFIX}006`,
    name: 'Tan Mei Ling',
    email: `tan.meiling${SEED_EMAIL_DOMAIN}`,
    phone_number: '+60123456706',
    complaint: {
      order_id: 'ORD-2026-1006',
      outlet_name: 'US Pizza Johor Bahru City Square',
      complaint_category: 'wrong_order',
      status: 'resolved',
      priority: 'Medium',
      sentiment: 'positive',
      description:
        'Missing garlic bread and extra cheese from my combo meal. Admin team already offered a voucher last week.',
      ai_summary:
        'Missing side items from combo order; previously compensated with a voucher and now marked resolved.',
    },
  },
  {
    user_id: `${SEED_USER_PREFIX}007`,
    name: 'Farid Ibrahim',
    email: `farid.ibrahim${SEED_EMAIL_DOMAIN}`,
    phone_number: '+60123456707',
    complaint: {
      order_id: 'ORD-2026-1007',
      outlet_name: 'US Pizza Melaka Ayer Keroh',
      complaint_category: 'late_delivery',
      status: 'in_progress',
      priority: 'Medium',
      sentiment: 'frustrated',
      description:
        'Delivery tracker showed “on the way” for 40 minutes but the rider had not left the outlet yet.',
      ai_summary:
        'Misleading delivery tracker status; customer waited over an hour and wants an explanation.',
    },
  },
  {
    user_id: `${SEED_USER_PREFIX}008`,
    name: 'Priya Devi',
    email: `priya.devi${SEED_EMAIL_DOMAIN}`,
    phone_number: '+60123456708',
    complaint: {
      order_id: 'ORD-2026-1008',
      outlet_name: 'US Pizza Ipoh Garden',
      complaint_category: 'food_quality',
      status: 'pending',
      priority: 'High',
      sentiment: 'urgent',
      description:
        'Found a hair on the chicken wings. I have photos attached and would like a full refund for hygiene reasons.',
      ai_summary:
        'Hygiene complaint with photo evidence; customer requests a full refund due to foreign object in food.',
    },
  },
  {
    user_id: `${SEED_USER_PREFIX}009`,
    name: 'Chong Kah Wai',
    email: `chong.kahwai${SEED_EMAIL_DOMAIN}`,
    phone_number: '+60123456709',
    complaint: {
      order_id: 'ORD-2026-1009',
      outlet_name: 'US Pizza Kuching Tabuan Jaya',
      complaint_category: 'other',
      status: 'resolved',
      priority: 'Low',
      sentiment: 'neutral',
      description:
        'Promo code PIZZA20 did not apply at checkout even though the banner is still on the website.',
      ai_summary:
        'Promotional code failed at checkout; issue resolved after manual voucher was applied by support.',
    },
  },
  {
    user_id: `${SEED_USER_PREFIX}010`,
    name: 'Aisha Rahman',
    email: `aisha.rahman${SEED_EMAIL_DOMAIN}`,
    phone_number: '+60123456710',
    complaint: {
      order_id: 'ORD-2026-1010',
      outlet_name: 'US Pizza Kota Kinabalu Lintas',
      complaint_category: 'service',
      status: 'pending',
      priority: 'Medium',
      sentiment: 'frustrated',
      description:
        'Outlet staff cancelled my online order without calling me. I only found out when I arrived for pickup.',
      ai_summary:
        'Pickup order cancelled without customer notification; customer wants the order remade or refunded.',
    },
  },
];

/**
 * Inserts 10 test customer profiles and linked complaints for QA / admin testing.
 * Idempotent: skips if any profile with user_id prefix "test-user-" already exists.
 * Test login password for all seeded users: Test1234
 *
 * @param {import('knex').Knex} knex
 */
exports.seed = async function seed(knex) {
  const existing = await knex('profile').where('user_id', 'like', `${SEED_USER_PREFIX}%`).first();
  if (existing) {
    console.log('003_test_users: seed data already present — skipping.');
    return;
  }

  await ensureRiderCategory(knex);

  const passwordHash = hashPassword(DEFAULT_TEST_PASSWORD);
  const now = new Date();

  await knex.transaction(async (trx) => {
    for (const entry of TEST_USERS) {
      const { complaint } = entry;

      await trx('profile').insert({
        user_id: entry.user_id,
        name: entry.name,
        email: entry.email,
        phone_number: entry.phone_number,
        password_hash: passwordHash,
        created_at: now,
        updated_at: now,
      });

      const customerContact = buildContact(entry.email, entry.phone_number);

      const [complaintId] = await trx('complaints').insert({
        customer_name: entry.name,
        customer_email: entry.email,
        customer_phone: entry.phone_number,
        customer_contact: customerContact,
        order_id: complaint.order_id,
        outlet_name: complaint.outlet_name,
        complaint_category: complaint.complaint_category,
        message: complaint.description,
        description: complaint.description,
        ai_summary: complaint.ai_summary,
        sentiment: complaint.sentiment,
        priority: complaint.priority,
        status: complaint.status,
        source: 'seed',
        created_at: now,
        updated_at: now,
      });

      const messages = [
        {
          complaint_id: complaintId,
          sender: 'customer',
          message_text: complaint.description,
          timestamp: now,
        },
      ];

      if (complaint.status === 'in_progress') {
        messages.push({
          complaint_id: complaintId,
          sender: 'admin',
          message_text: 'Status updated to In Progress',
          timestamp: new Date(now.getTime() + 60 * 60 * 1000),
        });
      }

      if (complaint.status === 'resolved') {
        messages.push({
          complaint_id: complaintId,
          sender: 'admin',
          message_text: 'Status updated to Resolved',
          timestamp: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        });
      }

      await trx('messages').insert(messages);
    }
  });

  console.log(`003_test_users: inserted ${TEST_USERS.length} test users and complaints.`);
  console.log(`003_test_users: login password for all test users is "${DEFAULT_TEST_PASSWORD}".`);
};
