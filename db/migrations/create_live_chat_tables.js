/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasSessions = await knex.schema.hasTable('live_chat_sessions');
  if (!hasSessions) {
    await knex.schema.createTable('live_chat_sessions', (table) => {
      table.increments('id').primary();
      table.string('chat_session_id', 64).notNullable().unique();
      table.string('user_id', 100).nullable();
      table
        .enu('status', ['WAITING_FOR_AGENT', 'AGENT_CONNECTED', 'RESOLVED'])
        .notNullable()
        .defaultTo('WAITING_FOR_AGENT');
      table.string('customer_name', 150).nullable();
      table.string('customer_contact', 200).nullable();
      table.string('outlet_name', 200).nullable();
      table.string('assigned_agent', 100).nullable().defaultTo('admin');
      table.integer('unread_count').notNullable().defaultTo(0);
      table.text('last_message').nullable();
      table.timestamp('last_message_at').nullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
      table.index(['status', 'updated_at']);
    });
  }

  const hasMessages = await knex.schema.hasTable('live_chat_messages');
  if (!hasMessages) {
    await knex.schema.createTable('live_chat_messages', (table) => {
      table.increments('id').primary();
      table
        .integer('live_session_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('live_chat_sessions')
        .onDelete('CASCADE');
      table.enu('sender', ['user', 'bot', 'admin']).notNullable();
      table.text('message_text').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.index(['live_session_id', 'created_at']);
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('live_chat_messages');
  await knex.schema.dropTableIfExists('live_chat_sessions');
};
