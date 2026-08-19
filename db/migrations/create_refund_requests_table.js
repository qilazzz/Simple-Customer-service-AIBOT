/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable('refund_requests');
  if (exists) return;

  await knex.schema.createTable('refund_requests', (table) => {
    table.increments('id').primary();
    table.string('ticket_number', 20).notNullable().unique();
    table.date('purchase_date').notNullable();
    table.string('receipt_number', 100).notNullable();
    table
      .enu('payment_method', [
        'Credit/Debit Card',
        'e-Wallet / QR Pay',
        'FPX / Online Banking',
      ])
      .notNullable();
    table.string('reason', 150).notNullable();
    table.text('details');
    table.string('customer_name', 150).notNullable();
    table.string('contact_no', 30).notNullable();
    table.string('email', 150).notNullable();
    table.string('attachment_path', 255);
    table
      .enu('status', ['Pending', 'In Progress', 'Approved', 'Rejected'])
      .notNullable()
      .defaultTo('Pending');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('refund_requests');
};
