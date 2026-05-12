# Device MySQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace demo device runtime data with MySQL-backed device data imported from `F-IT-010 Rev.01.xlsx`, while keeping ticket demo data unchanged.

**Architecture:** Add a workbook import pipeline plus a MySQL-first device repository keyed by `deviceId`. Route `Add New Device`, `Device Inventory`, and dashboard device summaries through the same device API and shared device model, while keeping assignment editable as mutable device metadata rather than identity.

**Tech Stack:** Next.js app routes, React 19, TypeScript, MySQL via `mysql2`, Node test runner, `tsx`, and an Excel parsing library added during implementation.

---

### Task 1: Lock The Shared Device Contract To The Excel-Backed Shape

**Files:**
- Modify: `app/types.ts`
- Modify: `app/views/AddDeviceForm.test.ts`
- Modify: `app/views/Inventory.test.ts`
- Modify: `app/lib/devices/deviceService.test.ts`

- [ ] **Step 1: Write the failing tests for `deviceId` primary-key behavior and shared field names**

Add these expectations before changing implementation:

```ts
test('requires a deviceId in add-device payloads', () => {
  assert.equal(
    validateDeviceForm({
      deviceId: '',
      department: 'IT',
      status: 'Active',
      ipMode: 'DHCP',
      ipAddress: '',
      os: 'Windows 11 Pro',
      deviceType: 'PC',
      assignedTo: '',
      model: 'OptiPlex 7000',
      hdd: '',
      ram: '',
      cpu: '',
      installDate: '',
      expireDatePrimary: '',
      expireDateSecondary: '',
      warranty: '',
      yearValue: '',
      osLicense: '',
      msOfficeVersion: '',
      notes: '',
    }),
    'Device ID is required.'
  );
});

test('keeps assignment updates separate from device identity', () => {
  const updated = updateDeviceAssignment(MOCK_DEVICES, MOCK_DEVICES[0].deviceId, 'new.user');
  assert.equal(updated[0].deviceId, MOCK_DEVICES[0].deviceId);
  assert.equal(updated[0].assignedTo, 'new.user');
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail for the right reason**

Run: `npm.cmd test -- app/views/AddDeviceForm.test.ts`

Expected: FAIL with missing `deviceId` form support and/or mismatched field names.

Run: `npm.cmd test -- app/views/Inventory.test.ts`

Expected: FAIL because assignment helpers still work on the old assignee object shape or old identity fields.

- [ ] **Step 3: Update the shared type surface in `app/types.ts`**

Apply the shared device contract needed by the workbook-backed model:

```ts
export type DeviceType = 'Laptop' | 'PC' | 'Server' | 'Notebook' | 'Desktop' | 'Unknown';
export type DeviceStatus = 'Active' | 'Inactive' | 'Out of Service';
export type IpMode = 'Manual' | 'DHCP';

export interface Device {
  deviceId: string;
  assetNo: string;
  ipMode: IpMode;
  ipAddress: string;
  department: string;
  assignedTo: string;
  deviceType: DeviceType;
  model: string;
  hdd: string;
  ram: string;
  cpu: string;
  installDate: string;
  expireDatePrimary: string;
  expireDateSecondary: string;
  warranty: string;
  yearValue: string;
  os: string;
  osLicense: string;
  msOfficeVersion: string;
  status: DeviceStatus;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}
```

- [ ] **Step 4: Update the tests to the final workbook-backed field set and keep them green**

Replace old fixture assumptions like `id`, nested `assignedTo`, `serialNumber`, and `deviceName` with:

```ts
const device = {
  deviceId: 'CAR001',
  assetNo: '1',
  ipMode: 'DHCP',
  ipAddress: '10.0.0.10',
  department: 'IT',
  assignedTo: 'chakrit',
  deviceType: 'PC',
  model: 'OptiPlex 360',
  hdd: '500 GB',
  ram: '4',
  cpu: 'Pentium Dual-Core',
  installDate: '42971',
  expireDatePrimary: '43356',
  expireDateSecondary: '43356',
  warranty: '1',
  yearValue: '6',
  os: 'Windows 10 Pro',
  osLicense: 'OEM',
  msOfficeVersion: '2019',
  status: 'Active',
  notes: '',
};
```

- [ ] **Step 5: Run the focused tests again**

Run: `npm.cmd test -- app/views/AddDeviceForm.test.ts`

Expected: PASS

Run: `npm.cmd test -- app/views/Inventory.test.ts`

Expected: PASS

Run: `npm.cmd test -- app/lib/devices/deviceService.test.ts`

Expected: still FAIL, but now only for service/repository mismatches that Task 3 will address.

- [ ] **Step 6: Commit**

```bash
git add app/types.ts app/views/AddDeviceForm.test.ts app/views/Inventory.test.ts app/lib/devices/deviceService.test.ts
git commit -m "test: lock workbook-backed device contract"
```

### Task 2: Build The Excel Import Parser And Import Tests

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `app/lib/devices/excelImport.ts`
- Create: `app/lib/devices/excelImport.test.ts`
- Create: `scripts/import-devices-from-excel.ts`

- [ ] **Step 1: Write failing import tests for row mapping and skip rules**

Create `app/lib/devices/excelImport.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapWorkbookRowToDeviceRecord, shouldImportWorkbookRow } from './excelImport';

test('maps workbook columns into a device record keyed by deviceId', () => {
  const record = mapWorkbookRowToDeviceRecord({
    No: '64',
    Name: 'CAR163',
    'IP Address': 'DHCP',
    'Dept.': 'EN',
    'User Log on': 'sasiluk_en',
    TYPE: 'Notebook',
    Model: 'Thinkbook15 G3 ACL',
    HDD: '500 GB',
    RAM: '8',
    CPU: 'Ryzen 5 5500U',
    'Install Date': '44613',
    'Expire Date': '44613',
    'Expire Date 2': '44978',
    Waranty: '1',
    Year: '0',
    OS: '11 Pro',
    'OS Licens': 'OEM',
    'MS Office V.': '2016',
  });

  assert.equal(record.deviceId, 'CAR163');
  assert.equal(record.assetNo, '64');
  assert.equal(record.assignedTo, 'sasiluk_en');
  assert.equal(record.ipMode, 'DHCP');
});

test('skips workbook footer and note rows', () => {
  assert.equal(
    shouldImportWorkbookRow({
      Name: 'หมายเหตุ : ทำการอัพเดททุก 3 เดือน ( ทุกวันที่ 1 )',
      TYPE: '',
      Model: '',
      OS: '',
      'Dept.': '',
      'User Log on': '',
    }),
    false
  );
});
```

- [ ] **Step 2: Run the new import test to verify it fails**

Run: `npm.cmd test -- app/lib/devices/excelImport.test.ts`

Expected: FAIL with missing module/function errors.

- [ ] **Step 3: Add the workbook parsing dependency**

Update `package.json` dependencies with a single parser library:

```json
"xlsx": "^0.18.5"
```

Install it:

Run: `npm install`

Expected: dependency added to `package-lock.json`.

- [ ] **Step 4: Implement the importer helpers in `app/lib/devices/excelImport.ts`**

Add a focused parser module:

```ts
import * as XLSX from 'xlsx';
import type { Device } from '../../types';

export interface WorkbookRow {
  No?: string;
  Name?: string;
  'IP Address'?: string;
  'Dept.'?: string;
  'User Log on'?: string;
  TYPE?: string;
  Model?: string;
  HDD?: string;
  RAM?: string;
  CPU?: string;
  'Install Date'?: string;
  'Expire Date'?: string;
  'Expire Date 2'?: string;
  Waranty?: string;
  Year?: string;
  OS?: string;
  'OS Licens'?: string;
  'MS Office V.'?: string;
}

export function shouldImportWorkbookRow(row: WorkbookRow) {
  const deviceId = row.Name?.trim() ?? '';
  if (!deviceId) return false;
  if (deviceId.includes('หมายเหตุ')) return false;
  if (deviceId.includes('ผู้จัดทำ')) return false;
  if (deviceId.includes('ผู้อนุมัติ')) return false;
  return [row.TYPE, row.Model, row.OS, row['Dept.'], row['User Log on']].some(
    (value) => (value ?? '').toString().trim().length > 0
  );
}

export function mapWorkbookRowToDeviceRecord(row: WorkbookRow): Device {
  const rawIp = row['IP Address']?.trim() ?? '';
  const ipMode = rawIp.toUpperCase() === 'DHCP' ? 'DHCP' : rawIp ? 'Manual' : 'DHCP';

  return {
    deviceId: row.Name?.trim() ?? '',
    assetNo: row.No?.trim() ?? '',
    ipMode,
    ipAddress: ipMode === 'Manual' ? rawIp : '',
    department: row['Dept.']?.trim() ?? '',
    assignedTo: row['User Log on']?.trim() ?? '',
    deviceType: normalizeWorkbookDeviceType(row.TYPE),
    model: row.Model?.trim() ?? '',
    hdd: row.HDD?.trim() ?? '',
    ram: row.RAM?.trim() ?? '',
    cpu: row.CPU?.trim() ?? '',
    installDate: row['Install Date']?.trim() ?? '',
    expireDatePrimary: row['Expire Date']?.trim() ?? '',
    expireDateSecondary: row['Expire Date 2']?.trim() ?? '',
    warranty: row.Waranty?.trim() ?? '',
    yearValue: row.Year?.trim() ?? '',
    os: row.OS?.trim() ?? '',
    osLicense: row['OS Licens']?.trim() ?? '',
    msOfficeVersion: row['MS Office V.']?.trim() ?? '',
    status: 'Active',
    notes: '',
  };
}
```

- [ ] **Step 5: Add the workbook import script in `scripts/import-devices-from-excel.ts`**

Seed the script with a direct workbook-to-repository pipeline:

```ts
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { getDeviceDbPool } from '../app/lib/db/mysql';
import { mapWorkbookRowToDeviceRecord, shouldImportWorkbookRow } from '../app/lib/devices/excelImport';

const workbook = XLSX.read(readFileSync('F-IT-010 Rev.01.xlsx'));
const sheet = workbook.Sheets['F-IT-010 Rev.00(Update)'];
if (!sheet) throw new Error('Missing sheet F-IT-010 Rev.00(Update)');

const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { range: 4, defval: '' });
const db = getDeviceDbPool();

for (const rawRow of rows) {
  const row = {
    No: rawRow['No'],
    Name: rawRow['Name'],
    'IP Address': rawRow['IP Address'],
    'Dept.': rawRow['Dept.'],
    'User Log on': rawRow['User Log on'],
    TYPE: rawRow['TYPE'],
    Model: rawRow['Model'],
    HDD: rawRow['HDD'],
    RAM: rawRow['RAM'],
    CPU: rawRow['CPU'],
    'Install Date': rawRow['Install Date'],
    'Expire Date': rawRow['Expire Date'],
    'Expire Date 2': rawRow['__EMPTY_12'],
    Waranty: rawRow['Waranty'],
    Year: rawRow['Year'],
    OS: rawRow['OS'],
    'OS Licens': rawRow['OS Licens'],
    'MS Office V.': rawRow['MS Office V.'],
  };

  if (!shouldImportWorkbookRow(row)) continue;
  const device = mapWorkbookRowToDeviceRecord(row);
  await db.execute(/* upsert SQL added in Task 3 */);
}
```

- [ ] **Step 6: Run the import test again**

Run: `npm.cmd test -- app/lib/devices/excelImport.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app/lib/devices/excelImport.ts app/lib/devices/excelImport.test.ts scripts/import-devices-from-excel.ts
git commit -m "feat: add excel device import pipeline"
```

### Task 3: Replace The Device Repository With A MySQL-First `deviceId` Repository

**Files:**
- Modify: `app/lib/devices/deviceService.ts`
- Modify: `app/lib/devices/deviceService.test.ts`
- Modify: `app/api/devices/route.ts`
- Create: `app/api/devices/[deviceId]/route.ts`
- Modify: `docs/device-database.md`

- [ ] **Step 1: Write failing repository tests for `deviceId` primary-key creation and MySQL row shape**

Add these tests in `app/lib/devices/deviceService.test.ts`:

```ts
test('creates a device keyed by deviceId instead of a generated id', async () => {
  const repository = new FileDeviceRepository(filePath);
  const created = await createDevice(
    {
      deviceId: 'CAR200',
      department: 'IT',
      assignedTo: 'chakrit',
      deviceType: 'Notebook',
      model: 'ThinkBook',
      ipMode: 'DHCP',
      ipAddress: '',
      os: 'Windows 11 Pro',
      status: 'Active',
    },
    repository
  );

  assert.equal(created.deviceId, 'CAR200');
});

test('rejects duplicate deviceId values', async () => {
  await createDevice({ deviceId: 'CAR200', ...baseInput }, repository);
  await assert.rejects(() => createDevice({ deviceId: 'CAR200', ...baseInput }, repository));
});
```

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `npm.cmd test -- app/lib/devices/deviceService.test.ts`

Expected: FAIL because the service still expects generated IDs and pre-migration fields.

- [ ] **Step 3: Rewrite `app/lib/devices/deviceService.ts` around the workbook-backed schema**

Reshape the service surface like this:

```ts
export interface CreateDeviceInput {
  deviceId: string;
  assetNo?: string;
  ipMode: IpMode;
  ipAddress: string;
  department: string;
  assignedTo: string;
  deviceType: DeviceType;
  model: string;
  hdd: string;
  ram: string;
  cpu: string;
  installDate: string;
  expireDatePrimary: string;
  expireDateSecondary: string;
  warranty: string;
  yearValue: string;
  os: string;
  osLicense: string;
  msOfficeVersion: string;
  status: DeviceStatus;
  notes: string;
}

export interface DeviceRepository {
  create(device: CreateDeviceInput): Promise<Device>;
  list(): Promise<Device[]>;
  updateStatus(deviceId: string, status: DeviceStatus): Promise<Device>;
  updateAssignedTo(deviceId: string, assignedTo: string): Promise<Device>;
  upsertMany(devices: Device[]): Promise<void>;
}
```

Use MySQL SQL in this shape:

```ts
await db.execute(
  `INSERT INTO devices (
     deviceId, assetNo, ipMode, ipAddress, department, assignedTo, deviceType,
     model, hdd, ram, cpu, installDate, expireDatePrimary, expireDateSecondary,
     warranty, yearValue, os, osLicense, msOfficeVersion, status, notes
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE
     assetNo = VALUES(assetNo),
     ipMode = VALUES(ipMode),
     ipAddress = VALUES(ipAddress),
     department = VALUES(department),
     assignedTo = VALUES(assignedTo),
     deviceType = VALUES(deviceType),
     model = VALUES(model),
     hdd = VALUES(hdd),
     ram = VALUES(ram),
     cpu = VALUES(cpu),
     installDate = VALUES(installDate),
     expireDatePrimary = VALUES(expireDatePrimary),
     expireDateSecondary = VALUES(expireDateSecondary),
     warranty = VALUES(warranty),
     yearValue = VALUES(yearValue),
     os = VALUES(os),
     osLicense = VALUES(osLicense),
     msOfficeVersion = VALUES(msOfficeVersion)`
);
```

- [ ] **Step 4: Expand the API routes**

Keep `GET` and `POST` in `app/api/devices/route.ts`, and add a per-device update route in `app/api/devices/[deviceId]/route.ts`:

```ts
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  const body = await request.json();

  if (body.status) {
    const device = await updateDeviceStatus(deviceId, body.status);
    return Response.json({ device });
  }

  if (typeof body.assignedTo === 'string') {
    const device = await updateDeviceAssignedTo(deviceId, body.assignedTo);
    return Response.json({ device });
  }

  return Response.json({ error: 'No supported update fields provided.' }, { status: 400 });
}
```

- [ ] **Step 5: Update the schema doc to the final table**

Replace the old schema in `docs/device-database.md` with the workbook-backed table:

```sql
CREATE TABLE devices (
  deviceId VARCHAR(120) NOT NULL PRIMARY KEY,
  assetNo VARCHAR(32) NOT NULL DEFAULT '',
  ipMode ENUM('Manual', 'DHCP') NOT NULL DEFAULT 'DHCP',
  ipAddress VARCHAR(64) NOT NULL DEFAULT '',
  department VARCHAR(120) NOT NULL DEFAULT '',
  assignedTo VARCHAR(160) NOT NULL DEFAULT '',
  deviceType VARCHAR(40) NOT NULL DEFAULT '',
  model VARCHAR(200) NOT NULL DEFAULT '',
  hdd VARCHAR(160) NOT NULL DEFAULT '',
  ram VARCHAR(80) NOT NULL DEFAULT '',
  cpu VARCHAR(200) NOT NULL DEFAULT '',
  installDate VARCHAR(40) NOT NULL DEFAULT '',
  expireDatePrimary VARCHAR(40) NOT NULL DEFAULT '',
  expireDateSecondary VARCHAR(40) NOT NULL DEFAULT '',
  warranty VARCHAR(40) NOT NULL DEFAULT '',
  yearValue VARCHAR(40) NOT NULL DEFAULT '',
  os VARCHAR(120) NOT NULL DEFAULT '',
  osLicense VARCHAR(120) NOT NULL DEFAULT '',
  msOfficeVersion VARCHAR(120) NOT NULL DEFAULT '',
  status ENUM('Active', 'Inactive', 'Out of Service') NOT NULL DEFAULT 'Active',
  notes TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

- [ ] **Step 6: Run repository and route verification**

Run: `npm.cmd test -- app/lib/devices/deviceService.test.ts`

Expected: PASS

Run: `npm.cmd test`

Expected: all existing tests still pass or only frontend tests fail for the still-unmigrated UI.

- [ ] **Step 7: Commit**

```bash
git add app/lib/devices/deviceService.ts app/lib/devices/deviceService.test.ts app/api/devices/route.ts app/api/devices/[deviceId]/route.ts docs/device-database.md
git commit -m "feat: migrate device repository to mysql deviceId model"
```

### Task 4: Migrate Add Device, Inventory, And App State Off `MOCK_DEVICES`

**Files:**
- Modify: `app/views/AddDeviceForm.tsx`
- Modify: `app/views/AddDeviceForm.test.ts`
- Modify: `app/views/Inventory.tsx`
- Modify: `app/views/Inventory.test.ts`
- Modify: `app/RepairLinkApp.tsx`

- [ ] **Step 1: Write failing UI tests for `deviceId` entry and string-based assignee editing**

Add a form payload expectation:

```ts
test('builds a mysql device payload keyed by deviceId', () => {
  assert.deepEqual(
    buildCreateDevicePayload({
      deviceId: 'CAR200',
      department: 'IT',
      assignedTo: 'chakrit',
      deviceType: 'Notebook',
      model: 'ThinkBook',
      ipMode: 'DHCP',
      ipAddress: '',
      os: 'Windows 11 Pro',
      status: 'Active',
      hdd: '',
      ram: '',
      cpu: '',
      installDate: '',
      expireDatePrimary: '',
      expireDateSecondary: '',
      warranty: '',
      yearValue: '',
      osLicense: '',
      msOfficeVersion: '',
      notes: '',
      assetNo: '',
    }),
    { deviceId: 'CAR200', department: 'IT', assignedTo: 'chakrit', ipMode: 'DHCP', ipAddress: '', os: 'Windows 11 Pro', status: 'Active', deviceType: 'Notebook', model: 'ThinkBook', hdd: '', ram: '', cpu: '', installDate: '', expireDatePrimary: '', expireDateSecondary: '', warranty: '', yearValue: '', osLicense: '', msOfficeVersion: '', notes: '', assetNo: '' }
  );
});
```

- [ ] **Step 2: Run the targeted UI tests to verify failure**

Run: `npm.cmd test -- app/views/AddDeviceForm.test.ts`

Expected: FAIL because the form still uses pre-migration fields.

Run: `npm.cmd test -- app/views/Inventory.test.ts`

Expected: FAIL because the inventory helper still assumes nested assignee data or mock-only fields.

- [ ] **Step 3: Update `AddDeviceForm.tsx` to collect the final MySQL-backed fields**

Shift the form state to the approved contract:

```ts
export interface AddDeviceFormValues {
  deviceId: string;
  assetNo: string;
  ipMode: IpMode;
  ipAddress: string;
  department: string;
  assignedTo: string;
  deviceType: DeviceType;
  model: string;
  hdd: string;
  ram: string;
  cpu: string;
  installDate: string;
  expireDatePrimary: string;
  expireDateSecondary: string;
  warranty: string;
  yearValue: string;
  os: string;
  osLicense: string;
  msOfficeVersion: string;
  status: DeviceStatus;
  notes: string;
}
```

Keep validation minimal:

```ts
if (!values.deviceId.trim()) return 'Device ID is required.';
if (!values.department.trim()) return 'Department is required.';
if (!values.os.trim()) return 'Operating system is required.';
if (values.ipMode === 'Manual' && !values.ipAddress.trim()) {
  return 'IP address is required when IP mode is Manual.';
}
```

- [ ] **Step 4: Refit `Inventory.tsx` to the string-based `assignedTo` field and fetched devices**

Adjust helpers and rendering:

```ts
export function updateDeviceAssignment(devices: Device[], deviceId: string, assignedTo: string) {
  return devices.map((device) =>
    device.deviceId === deviceId ? { ...device, assignedTo } : device
  );
}

export function updateDeviceStatus(devices: Device[], deviceId: string, status: Device['status']) {
  return devices.map((device) =>
    device.deviceId === deviceId ? { ...device, status } : device
  );
}
```

When saving edits:

```ts
await fetch(`/api/devices/${encodeURIComponent(device.deviceId)}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ assignedTo: draftAssignedTo }),
});
```

- [ ] **Step 5: Move app-level device loading in `RepairLinkApp.tsx` entirely to the API**

Replace the seeded mock state with fetch-backed state:

```ts
const [devices, setDevices] = useState<Device[]>([]);

useEffect(() => {
  let cancelled = false;

  async function loadDevices() {
    const response = await fetch('/api/devices');
    const result = await response.json();
    if (!cancelled) {
      setDevices(result.devices ?? []);
    }
  }

  void loadDevices();
  return () => {
    cancelled = true;
  };
}, []);
```

- [ ] **Step 6: Run the focused UI tests again**

Run: `npm.cmd test -- app/views/AddDeviceForm.test.ts`

Expected: PASS

Run: `npm.cmd test -- app/views/Inventory.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/views/AddDeviceForm.tsx app/views/AddDeviceForm.test.ts app/views/Inventory.tsx app/views/Inventory.test.ts app/RepairLinkApp.tsx
git commit -m "feat: switch add and inventory flows to mysql devices"
```

### Task 5: Replace Dashboard Runtime Device Mocks And Verify End-To-End Migration

**Files:**
- Modify: `app/views/Dashboard.tsx`
- Create: `app/views/Dashboard.test.ts`
- Modify: `app/data/mockData.ts`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Write the failing dashboard test for API-backed device summaries**

Create `app/views/Dashboard.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Dashboard from './Dashboard';

test('renders fleet summary from provided devices instead of MOCK_DEVICES', () => {
  const markup = renderToStaticMarkup(
    React.createElement(Dashboard, {
      onTicketClick: () => undefined,
      devices: [
        { deviceId: 'CAR001', status: 'Active', deviceType: 'Notebook', assignedTo: 'chakrit', ipMode: 'DHCP', ipAddress: '', department: 'IT', model: '', hdd: '', ram: '', cpu: '', installDate: '', expireDatePrimary: '', expireDateSecondary: '', warranty: '', yearValue: '', os: 'Windows 11 Pro', osLicense: '', msOfficeVersion: '', notes: '', assetNo: '' },
      ],
    })
  );

  assert.match(markup, /Total Assets/);
  assert.match(markup, />1</);
});
```

- [ ] **Step 2: Run the dashboard test to verify it fails**

Run: `npm.cmd test -- app/views/Dashboard.test.ts`

Expected: FAIL because `Dashboard` still imports `MOCK_DEVICES` directly.

- [ ] **Step 3: Update `Dashboard.tsx` to consume passed-in devices and keep ticket mocks**

Change the component signature:

```ts
export default function Dashboard({
  onTicketClick,
  devices,
}: {
  onTicketClick: (id: string) => void;
  devices: Device[];
}) {
  const totalDevices = devices.length;
  const deviceStatusData = devices.map((device) => ({
    device,
    status: getWarrantyStatus(device.expireDateSecondary || device.expireDatePrimary),
  }));
}
```

In `RepairLinkApp.tsx`, pass the loaded device list:

```tsx
{currentView === 'dashboard' && (
  <Dashboard
    key="dashboard"
    devices={devices}
    onTicketClick={(id) => {
      setSelectedTicketId(id);
      setCurrentView('tickets');
    }}
  />
)}
```

- [ ] **Step 4: Document the import/runtime setup**

Add environment and workflow notes:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
```

Add README steps:

```md
1. Create the `devices` table from `docs/device-database.md`
2. Configure MySQL env vars
3. Run `npx tsx scripts/import-devices-from-excel.ts`
4. Start the app with `npm run dev`
```

- [ ] **Step 5: Run full verification**

Run: `npm.cmd test`

Expected: PASS with all device, dashboard, and ticket tests green.

If the app has a local MySQL instance available, also run:

Run: `npx tsx scripts/import-devices-from-excel.ts`

Expected: import completes without duplicate-key crashes and upserts workbook rows by `deviceId`.

- [ ] **Step 6: Commit**

```bash
git add app/views/Dashboard.tsx app/views/Dashboard.test.ts app/data/mockData.ts .env.example README.md
git commit -m "feat: remove demo device runtime data"
```

## Self-Review

- Spec coverage: the plan includes workbook parsing, MySQL schema alignment, API updates, add-device flow, inventory editing, dashboard migration, and documentation.
- Placeholder scan: no `TBD`, `TODO`, or vague “add validation” steps remain; each task names exact files and commands.
- Type consistency: later tasks use `deviceId`, `assignedTo`, `department`, `ipMode`, and workbook column-aligned fields consistently with Task 1.

