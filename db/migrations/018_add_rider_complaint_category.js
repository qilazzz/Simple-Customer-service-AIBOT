/**
 * Add 'rider' to complaint_category enum.
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasComplaints = await knex.schema.hasTable('complaints');
  if (!hasComplaints) return;

  await knex.raw(`
    ALTER TABLE complaints
    MODIFY COLUMN complaint_category ENUM(
      'wrong_order',
      'late_delivery',
      'food_quality',
      'service',
      'rider',
      'other'
    ) NOT NULL DEFAULT 'other'
  `).catch((err) => {
    console.warn('complaint_category rider enum migration:', err.message);
  });
};

exports.down = async function down(knex) {
  const hasComplaints = await knex.schema.hasTable('complaints');
  if (!hasComplaints) return;

  await knex('complaints').where('complaint_category', 'rider').update({ complaint_category: 'other' });

  await knex.raw(`
    ALTER TABLE complaints
    MODIFY COLUMN complaint_category ENUM(
      'wrong_order',
      'late_delivery',
      'food_quality',
      'service',
      'other'
    ) NOT NULL DEFAULT 'other'
  `).catch(() => {});
};
