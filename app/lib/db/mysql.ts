import mysql, { type Pool } from 'mysql2/promise';

let pool: Pool | null = null;

export function getDeviceDbPool() {
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    throw new Error('Database connection is not configured.');
  }

  if (!pool) {
    pool = process.env.DATABASE_URL
      ? mysql.createPool(process.env.DATABASE_URL)
      : mysql.createPool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT ?? 3306),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          waitForConnections: true,
          connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
          namedPlaceholders: true,
        });
  }

  return pool;
}
