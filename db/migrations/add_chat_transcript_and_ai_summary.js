/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasChatTranscript = await knex.schema.hasColumn('complaints', 'chat_transcript');
  if (!hasChatTranscript) {
    await knex.schema.alterTable('complaints', (table) => {
      table.text('chat_transcript').nullable();
    });
  }

  const hasAiSummary = await knex.schema.hasColumn('complaints', 'ai_summary');
  if (!hasAiSummary) {
    await knex.schema.alterTable('complaints', (table) => {
      table.text('ai_summary').nullable();
      table.string('sentiment', 50).nullable();
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  const hasChatTranscript = await knex.schema.hasColumn('complaints', 'chat_transcript');
  if (hasChatTranscript) {
    await knex.schema.alterTable('complaints', (table) => {
      table.dropColumn('chat_transcript');
    });
  }
};
