/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('bot_commands', (table) => {
    table.increments('id').primary();
    table.string('intent_name', 100).notNullable();
    table.json('keywords').notNullable();
    table
      .enu('response_type', ['text', 'action_api', 'gemini_ai'])
      .notNullable();
    table.text('response_payload').nullable();
    table.string('action_handler', 100).nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('ai_configurations', (table) => {
    table.increments('id').primary();
    table.string('config_key', 100).notNullable().unique();
    table.text('config_value').notNullable();
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
  await knex.schema.dropTableIfExists('ai_configurations');
  await knex.schema.dropTableIfExists('bot_commands');
};
