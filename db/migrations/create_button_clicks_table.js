/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable('button_clicks');
  if (exists) return;

  await knex.schema.createTable('button_clicks', (table) => {
    table.increments('id').primary();
    table.string('button_name', 150).notNullable();
    table.string('user_id', 100).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['button_name', 'created_at']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('button_clicks');
};
