/**
 * Customer profile records keyed by app/chat user_id for analytics drill-down.
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable('profile');
  if (exists) return;

  await knex.schema.createTable('profile', (table) => {
    table.string('user_id', 100).primary();
    table.string('name', 150).nullable();
    table.string('email', 150).nullable();
    table.string('phone_number', 50).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('profile');
};
