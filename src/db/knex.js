const knex = require('knex');
const knexConfig = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

if (!config) {
  throw new Error(`Knex environment "${environment}" is not configured.`);
}

const db = knex(config);

module.exports = db;
