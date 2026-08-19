/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasOutlet = await knex.schema.hasColumn('complaints', 'outlet_name');
  if (!hasOutlet) {
    await knex.schema.alterTable('complaints', (table) => {
      table.string('outlet_name', 150).nullable();
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const hasOutlet = await knex.schema.hasColumn('complaints', 'outlet_name');
  if (hasOutlet) {
    await knex.schema.alterTable('complaints', (table) => {
      table.dropColumn('outlet_name');
    });
  }
};
