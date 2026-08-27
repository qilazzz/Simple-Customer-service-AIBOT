require('dotenv').config();

const useSsl =
  process.env.DB_SSL === 'true' ||
  process.env.DB_SSL === true ||
  process.env.DB_SSL === '1';

const shared = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'customer_service_bot',
    charset: 'utf8mb4',
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  },
  pool: {
    min: 0,
    max: 10,
  },
  migrations: {
    directory: './db/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './db/seeds',
  },
};

module.exports = {
  development: shared,
  production: shared,
  test: shared,
};
