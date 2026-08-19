/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('complaints', (table) => {
    table.increments('id').primary();
    table.string('order_id', 100).nullable();
    table.string('customer_name', 150).notNullable();
    table.string('customer_email', 150).notNullable();
    table.string('customer_phone', 50).nullable();
    table
      .enu('complaint_category', [
        'wrong_order',
        'late_delivery',
        'food_quality',
        'service',
        'other',
      ])
      .notNullable()
      .defaultTo('other');
    table.text('message').notNullable();
    table
      .enu('status', ['pending', 'in_review', 'resolved'])
      .notNullable()
      .defaultTo('pending');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table
      .timestamp('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('complaints');
};
