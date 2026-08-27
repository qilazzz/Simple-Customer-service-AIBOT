/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasSessions = await knex.schema.hasTable('live_chat_sessions');
  if (!hasSessions) return;

  await knex.raw(`
    ALTER TABLE live_chat_sessions
    MODIFY COLUMN status ENUM(
      'WAITING_FOR_FIRST_MESSAGE',
      'WAITING_FOR_AGENT',
      'AGENT_CONNECTED',
      'RESOLVED',
      'DELETED'
    ) NOT NULL DEFAULT 'WAITING_FOR_FIRST_MESSAGE'
  `);

  await knex.raw(`
    UPDATE live_chat_sessions AS s
    SET s.status = 'WAITING_FOR_FIRST_MESSAGE'
    WHERE s.status = 'WAITING_FOR_AGENT'
      AND NOT EXISTS (
        SELECT 1
        FROM live_chat_messages AS m
        WHERE m.live_session_id = s.id
          AND m.sender = 'user'
      )
  `);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const hasSessions = await knex.schema.hasTable('live_chat_sessions');
  if (!hasSessions) return;

  await knex('live_chat_sessions')
    .where({ status: 'WAITING_FOR_FIRST_MESSAGE' })
    .update({ status: 'WAITING_FOR_AGENT' });

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
