import { loadDeviceImportEnvironment } from '../app/lib/devices/importEnvironment';
import { getDeviceDbPool } from '../app/lib/db/mysql';

async function main() {
  loadDeviceImportEnvironment();

  const pool = getDeviceDbPool();

  console.log('Running migration: creating system_settings table if not exists...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
      setting_value LONGTEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updated_by VARCHAR(100) NOT NULL DEFAULT 'system'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('Migration complete: system_settings table is ready.');
  await pool.end();
}

void main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
