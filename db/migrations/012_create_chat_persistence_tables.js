/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasSessions = await knex.schema.hasTable('chat_sessions');
  if (!hasSessions) {
    await knex.schema.createTable('chat_sessions', (table) => {
      table.string('id', 64).primary();
      table.string('user_id', 100).notNullable().index();
      table.string('flow', 50).notNullable().defaultTo('menu');
      table.string('stage', 50).notNullable().defaultTo('menu');
      table.integer('live_session_id').unsigned().nullable();
      table.enu('status', ['active', 'closed']).notNullable().defaultTo('active');
      table.json('collected').nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.index(['user_id', 'status', 'updated_at']);
    });
  }

  const hasMessages = await knex.schema.hasTable('chat_messages');
  if (!hasMessages) {
    await knex.schema.createTable('chat_messages', (table) => {
      table.increments('id').primary();
      table
        .string('session_id', 64)
        .notNullable()
        .references('id')
        .inTable('chat_sessions')
        .onDelete('CASCADE');
      table.enu('sender_type', ['user', 'bot', 'ai', 'admin']).notNullable();
      table.text('message_text').notNullable();
      table.integer('source_live_message_id').unsigned().nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.index(['session_id', 'created_at']);
      table.unique(['session_id', 'source_live_message_id']);
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_sessions');
};
