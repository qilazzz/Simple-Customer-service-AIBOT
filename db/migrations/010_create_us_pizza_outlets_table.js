/**
 * Outlets table — skipped if already created/imported manually.
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable('us_pizza_outlets');
  if (exists) return;

  await knex.schema.createTable('us_pizza_outlets', (table) => {
    table.string('outlet_id', 10).primary();
    table.string('outlet_name', 150).notNullable();
    table.text('address').notNullable();
    table.string('state', 50).notNullable();
    table.string('city', 50).notNullable();
    table.string('phone', 30);
    table.string('opening_hours', 100);
    table.text('location_url');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('us_pizza_outlets');
};
