/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasPassword = await knex.schema.hasColumn('profile', 'password_hash');
  if (!hasPassword) {
    await knex.schema.alterTable('profile', (table) => {
      table.string('password_hash', 255).nullable();
    });
  }

  try {
    await knex.schema.alterTable('profile', (table) => {
      table.unique(['email'], 'profile_email_unique');
    });
  } catch {
    // Unique index may already exist.
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const hasPassword = await knex.schema.hasColumn('profile', 'password_hash');
  if (hasPassword) {
    await knex.schema.alterTable('profile', (table) => {
      table.dropUnique(['email'], 'profile_email_unique');
      table.dropColumn('password_hash');
    });
  }
};
