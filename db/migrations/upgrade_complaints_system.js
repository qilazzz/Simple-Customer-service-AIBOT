/**
 * Upgrades complaints for AI chatbot system and adds messages table.
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasContact = await knex.schema.hasColumn('complaints', 'customer_contact');
  if (!hasContact) {
    await knex.schema.alterTable('complaints', (table) => {
      table.string('customer_contact', 200).nullable();
      table.text('description').nullable();
      table.json('attachment_urls').nullable();
      table.text('ai_summary').nullable();
      table.string('sentiment', 50).nullable();
      table.enu('priority', ['Low', 'Medium', 'High']).notNullable().defaultTo('Medium');
      table.string('source', 50).nullable().defaultTo('form');
    });

    await knex('complaints').update({
      customer_contact: knex.raw(
        "TRIM(CONCAT(COALESCE(customer_email, ''), IF(customer_phone IS NOT NULL AND customer_phone != '', CONCAT(' / ', customer_phone), '')))",
      ),
      description: knex.ref('message'),
      source: 'form',
    });
  }

  await knex.raw(`
    ALTER TABLE complaints
    MODIFY COLUMN status ENUM('pending', 'in_review', 'in_progress', 'resolved')
    NOT NULL DEFAULT 'pending'
  `).catch(() => {});

  await knex('complaints').where('status', 'in_review').update({ status: 'in_progress' });

  const hasMessages = await knex.schema.hasTable('messages');
  if (!hasMessages) {
    await knex.schema.createTable('messages', (table) => {
      table.increments('id').primary();
      table
        .integer('complaint_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('complaints')
        .onDelete('CASCADE');
      table.enu('sender', ['customer', 'ai', 'admin']).notNullable();
      table.text('message_text').notNullable();
      table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    });
  }
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('messages');
  const hasContact = await knex.schema.hasColumn('complaints', 'customer_contact');
  if (hasContact) {
    await knex.schema.alterTable('complaints', (table) => {
      table.dropColumn('customer_contact');
      table.dropColumn('description');
      table.dropColumn('attachment_urls');
      table.dropColumn('ai_summary');
      table.dropColumn('sentiment');
      table.dropColumn('priority');
      table.dropColumn('source');
    });
  }
};
