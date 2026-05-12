import {
  DEVICE_WORKBOOK_SHEET_NAME,
  mapWorkbookRowToDeviceRecord,
  readWorkbookRows,
  shouldImportWorkbookRow,
} from '../app/lib/devices/excelImport';
import { loadDeviceImportEnvironment } from '../app/lib/devices/importEnvironment';
import { DeviceDatabaseConfigurationError, upsertDevices } from '../app/lib/devices/deviceService';

const WORKBOOK_PATH = 'F-IT-010 Rev.01.xlsx';

async function main() {
  loadDeviceImportEnvironment();

  const rows = readWorkbookRows(WORKBOOK_PATH, DEVICE_WORKBOOK_SHEET_NAME);
  const devices = rows.filter(shouldImportWorkbookRow).map(mapWorkbookRowToDeviceRecord);

  if (devices.length === 0) {
    throw new Error(`No importable device rows were found in ${DEVICE_WORKBOOK_SHEET_NAME}.`);
  }

  await upsertDevices(devices);

  console.log(`Imported ${devices.length} devices from ${DEVICE_WORKBOOK_SHEET_NAME}.`);
}

void main().catch((error) => {
  if (error instanceof DeviceDatabaseConfigurationError) {
    console.error(
      'Database is not configured. Set DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME before importing.'
    );
    process.exitCode = 1;
    return;
  }

  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
