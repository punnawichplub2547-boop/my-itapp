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
       AND TABLE_NAME = 'devices'
       AND COLUMN_NAME = 'assignedEmail'`
  );

  if ((rows[0]?.cnt as number) > 0) {
    console.log('Column assignedEmail already exists in devices table — skipping.');
    await pool.end();
    return;
  }

  await pool.query(
    `ALTER TABLE devices
     ADD COLUMN assignedEmail VARCHAR(200) NOT NULL DEFAULT '' AFTER assignedTo`
  );

  console.log('Migration complete: added assignedEmail column to devices.');
  await pool.end();
}

void main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
