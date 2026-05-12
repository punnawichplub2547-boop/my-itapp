# Add Device IP Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Manual` and `DHCP` IP modes to the Add New Device flow, requiring an IP address only for manual entry and persisting the chosen mode.

**Architecture:** Keep the UI logic in `app/views/AddDeviceForm.tsx` with small exported helpers for validation and request payload shaping. Extend `app/lib/devices/deviceService.ts` so the API enforces the same contract and persists `ipMode` plus an optional `ipAddress`.

**Tech Stack:** Next.js App Router client component, React 19 stateful form handling, node:test with tsx, existing device API/service layer.

---

### Task 1: Add failing tests for IP mode behavior

**Files:**
- Modify: `app/views/AddDeviceForm.test.ts`
- Modify: `app/lib/devices/deviceService.test.ts`

- [ ] **Step 1: Write the failing form tests**

```ts
test('renders manual IP mode with a visible IP address input by default', () => {
  const markup = renderToStaticMarkup(React.createElement(AddDeviceForm, { onBack: () => undefined }));

  assert.match(markup, /IP Mode/);
  assert.match(markup, /<option selected=""[^>]*>Manual<\/option>/);
  assert.match(markup, /IP Address/);
});

test('requires an IP address only when manual mode is selected', () => {
  assert.equal(
    validateDeviceForm({
      deviceName: 'MacBook Pro',
      serialNumber: 'SN-DEMO-001',
      deviceType: 'Laptop',
      department: 'IT',
      assignmentStatus: 'Unassigned',
      ipMode: 'Manual',
      ipAddress: '',
    }),
    'IP address is required when IP mode is Manual.'
  );

  assert.equal(
    validateDeviceForm({
      deviceName: 'MacBook Pro',
      serialNumber: 'SN-DEMO-001',
      deviceType: 'Laptop',
      department: 'IT',
      assignmentStatus: 'Unassigned',
      ipMode: 'DHCP',
      ipAddress: '',
    }),
    ''
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- app/views/AddDeviceForm.test.ts`
Expected: FAIL because the IP mode markup and helper exports do not exist yet.

- [ ] **Step 3: Write the failing device service tests**

```ts
test('normalizes a manual IP address when present', () => {
  const normalized = normalizeCreateDeviceInput({
    deviceName: '  MacBook Pro M3  ',
    serialNumber: ' sn-demo-001 ',
    deviceType: 'Laptop',
    department: ' IT Operations ',
    assignmentStatus: 'Unassigned',
    ipMode: 'Manual',
    ipAddress: ' 10.10.10.5 ',
  });

  assert.deepEqual(normalized.ipMode, 'Manual');
  assert.deepEqual(normalized.ipAddress, '10.10.10.5');
});

test('allows dhcp mode without an IP address', () => {
  const normalized = normalizeCreateDeviceInput({
    deviceName: 'Dell Latitude 7440',
    serialNumber: 'demo-001',
    deviceType: 'Laptop',
    department: 'Engineering',
    assignmentStatus: 'Unassigned',
    ipMode: 'DHCP',
    ipAddress: '',
  });

  assert.equal(normalized.ipMode, 'DHCP');
  assert.equal(normalized.ipAddress, '');
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm.cmd test -- app/lib/devices/deviceService.test.ts`
Expected: FAIL because `ipMode` and `ipAddress` are not part of the current schema.

### Task 2: Implement minimal UI and service support

**Files:**
- Modify: `app/views/AddDeviceForm.tsx`
- Modify: `app/lib/devices/deviceService.ts`
- Modify: `docs/device-database.md`

- [ ] **Step 1: Add minimal UI state and helper logic**

```ts
const [ipMode, setIpMode] = useState<IpMode>('Manual');
const [ipAddress, setIpAddress] = useState('');
```

- [ ] **Step 2: Extend the payload and conditional validation**

```ts
body: JSON.stringify({
  deviceName,
  serialNumber,
  deviceType,
  department,
  assignmentStatus,
  ipMode,
  ipAddress: ipMode === 'Manual' ? ipAddress.trim() : '',
}),
```

- [ ] **Step 3: Extend server-side normalization and persistence contract**

```ts
export type IpMode = 'Manual' | 'DHCP';
```

- [ ] **Step 4: Update the schema doc to include `ip_mode` and optional `ip_address`**

```sql
ip_mode ENUM('Manual', 'DHCP') NOT NULL DEFAULT 'Manual',
ip_address VARCHAR(45) NOT NULL DEFAULT '',
```

### Task 3: Verify the feature end to end at the unit level

**Files:**
- Test: `app/views/AddDeviceForm.test.ts`
- Test: `app/lib/devices/deviceService.test.ts`

- [ ] **Step 1: Run the form test file**

Run: `npm.cmd test -- app/views/AddDeviceForm.test.ts`
Expected: PASS

- [ ] **Step 2: Run the device service test file**

Run: `npm.cmd test -- app/lib/devices/deviceService.test.ts`
Expected: PASS

- [ ] **Step 3: Run the full test suite**

Run: `npm.cmd test`
Expected: PASS with 0 failures
