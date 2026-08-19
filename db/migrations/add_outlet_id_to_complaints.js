/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasOutletId = await knex.schema.hasColumn('complaints', 'outlet_id');
  if (!hasOutletId) {
    await knex.schema.alterTable('complaints', (table) => {
      table.string('outlet_id', 10).nullable();
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const hasOutletId = await knex.schema.hasColumn('complaints', 'outlet_id');
  if (hasOutletId) {
    await knex.schema.alterTable('complaints', (table) => {
      table.dropColumn('outlet_id');
    });
  }
};
