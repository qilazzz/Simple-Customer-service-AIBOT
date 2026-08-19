/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('complaint_photos', (table) => {
    table.increments('id').primary();
    table
      .integer('complaint_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('complaints')
      .onDelete('CASCADE');
    table.string('file_path', 255).notNullable();
    table.string('original_name', 255).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('complaint_photos');
};
