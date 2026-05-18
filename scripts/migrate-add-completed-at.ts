import { loadDeviceImportEnvironment } from '../app/lib/devices/importEnvironment';
import { getDeviceDbPool } from '../app/lib/db/mysql';
import type { RowDataPacket } from 'mysql2/promise';

async function main() {
  loadDeviceImportEnvironment();

  const pool = getDeviceDbPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'repair_tickets'
       AND COLUMN_NAME = 'completed_at'`
  );

  if ((rows[0]?.cnt as number) > 0) {
    console.log('Column completed_at already exists — skipping.');
    await pool.end();
    return;
  }

  await pool.query(
    `ALTER TABLE repair_tickets
     ADD COLUMN completed_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at`
  );

  console.log('Migration complete: added completed_at column to repair_tickets.');
  await pool.end();
}

void main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
