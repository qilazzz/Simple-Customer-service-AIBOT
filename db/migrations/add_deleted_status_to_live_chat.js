/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasSessions = await knex.schema.hasTable('live_chat_sessions');
  if (!hasSessions) return;

  await knex.raw(`
    ALTER TABLE live_chat_sessions
    MODIFY COLUMN status ENUM(
      'WAITING_FOR_AGENT',
      'AGENT_CONNECTED',
      'RESOLVED',
      'DELETED'
    ) NOT NULL DEFAULT 'WAITING_FOR_AGENT'
  `);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const hasSessions = await knex.schema.hasTable('live_chat_sessions');
  if (!hasSessions) return;

  await knex('live_chat_sessions').where({ status: 'DELETED' }).update({ status: 'RESOLVED' });

  await knex.raw(`
    ALTER TABLE live_chat_sessions
    MODIFY COLUMN status ENUM(
      'WAITING_FOR_AGENT',
      'AGENT_CONNECTED',
      'RESOLVED'
    ) NOT NULL DEFAULT 'WAITING_FOR_AGENT'
  `);
};
