# Device MySQL Migration Design

## Goal

Replace demo device data with MySQL-backed device data sourced from the Excel workbook `F-IT-010 Rev.01.xlsx`, while keeping ticket demo data in place. `Add New Device`, `Device Inventory`, and device-related dashboard summaries should all read and write the same MySQL device records. `deviceId` must remain the stable device identity, and `assignedTo` must stay editable without changing that identity.

## Scope

In scope:

- Import device data from worksheet `F-IT-010 Rev.00(Update)`.
- Create or adjust the MySQL `devices` table to reflect the Excel columns plus app-owned fields.
- Remove runtime dependence on `MOCK_DEVICES` in:
  - `Add New Device`
  - `Device Inventory`
  - dashboard device summary widgets
- Keep `assignedTo` editable independently of `deviceId`.
- Preserve the ticket demo flows and `MOCK_TICKETS`.

Out of scope:

- Replacing ticket demo data.
- Fully normalizing device data into multiple relational tables.
- Historical import/versioning of multiple Excel sheets.
- Backfilling every older mock-only UI detail if not represented in the workbook.

## Source Of Truth

Workbook:

- File: `D:\Mini_case\my-itapp\F-IT-010 Rev.01.xlsx`
- Chosen sheet: `F-IT-010 Rev.00(Update)`

Why this sheet:

- It is materially different from `F-IT-010 Rev.00`.
- It contains additional rows and many updated field values.
- It is the best available candidate for the current asset register.

Relevant worksheet columns from row 4:

- `No`
- `Name`
- `IP Address`
- `Dept.`
- `User Log on`
- `TYPE`
- `Model`
- `HDD`
- `RAM`
- `CPU`
- `Install Date`
- `Expire Date`
- `Expire Date`
- `Waranty`
- `Year`
- `OS`
- `OS Licens`
- `MS Office V.`

Interpretation rules:

- `Name` is the stable `deviceId`.
- `User Log on` is the current `assignedTo`.
- `Dept.` is the device department field used for inventory filtering and display.
- The two `Expire Date` columns are preserved separately because the workbook uses both.
- The workbook contains blank/footer/signature rows near the end; the importer must skip non-device rows.

## Recommended Architecture

Use a single denormalized `devices` table that mirrors the Excel columns closely.

Reasons:

- Lowest-risk migration from workbook to app.
- Fastest path to removing demo device data.
- Keeps import logic straightforward.
- Avoids introducing unnecessary joins or partial migrations while the app is still small.

Not chosen:

- Full normalization into `devices`, `assignments`, and `departments` tables now.
  - Better long-term model, but slower and more error-prone for this migration.
- Staging-table-only import with runtime projection.
  - Useful for auditing, but unnecessary for current app scope.

## Data Model

### MySQL table

Table name: `devices`

Columns:

- `deviceId VARCHAR(120) NOT NULL PRIMARY KEY`
- `assetNo VARCHAR(32) NOT NULL DEFAULT ''`
- `ipMode ENUM('Manual','DHCP') NOT NULL DEFAULT 'DHCP'`
- `ipAddress VARCHAR(64) NOT NULL DEFAULT ''`
- `department VARCHAR(120) NOT NULL DEFAULT ''`
- `assignedTo VARCHAR(160) NOT NULL DEFAULT ''`
- `deviceType VARCHAR(40) NOT NULL DEFAULT ''`
- `model VARCHAR(200) NOT NULL DEFAULT ''`
- `hdd VARCHAR(160) NOT NULL DEFAULT ''`
- `ram VARCHAR(80) NOT NULL DEFAULT ''`
- `cpu VARCHAR(200) NOT NULL DEFAULT ''`
- `installDate VARCHAR(40) NOT NULL DEFAULT ''`
- `expireDatePrimary VARCHAR(40) NOT NULL DEFAULT ''`
- `expireDateSecondary VARCHAR(40) NOT NULL DEFAULT ''`
- `warranty VARCHAR(40) NOT NULL DEFAULT ''`
- `yearValue VARCHAR(40) NOT NULL DEFAULT ''`
- `os VARCHAR(120) NOT NULL DEFAULT ''`
- `osLicense VARCHAR(120) NOT NULL DEFAULT ''`
- `msOfficeVersion VARCHAR(120) NOT NULL DEFAULT ''`
- `status ENUM('Active','Inactive','Out of Service') NOT NULL DEFAULT 'Active'`
- `notes TEXT NULL`
- `createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`

Indexes:

- `PRIMARY KEY (deviceId)`
- `KEY idx_devices_department (department)`
- `KEY idx_devices_type (deviceType)`
- `KEY idx_devices_status (status)`
- `KEY idx_devices_assigned_to (assignedTo)`

### Application model

The shared app device model should align to this table and use:

- `deviceId` as the stable unique identity
- `assignedTo` as a mutable field
- `department`, `os`, `ipAddress`, `deviceType`, and `status` as first-class fields used by both add and inventory flows

The app should stop deriving department from assignment. Department belongs to the device record itself.

## Import Design

### Import mechanism

Create a one-time import script that:

1. Reads `F-IT-010 Rev.01.xlsx`
2. Selects sheet `F-IT-010 Rev.00(Update)`
3. Reads from the header-defined table starting after the header rows
4. Skips blank rows, note rows, signature rows, and malformed rows
5. Upserts into MySQL by `deviceId`

### Row filtering rules

A row is importable only if all of these are true:

- `Name` is non-empty
- `Name` is not a note/footer/signature phrase
- At least one of the main device fields is populated, such as `TYPE`, `Model`, `OS`, `Dept.`, or `User Log on`

Rows such as:

- the workbook update reminder note row
- signature lines
- approval labels

must be ignored.

### Upsert behavior

For each imported row:

- `deviceId` maps from `Name`
- `ipMode` defaults to `DHCP` for imported rows unless a later import rule maps a distinct manual value
- importable workbook columns overwrite matching DB columns
- `status` defaults to:
  - `Active` when the workbook row appears to represent a live asset
  - `Inactive` only if explicit business rules are later added
  - for this migration, use `Active` when no better source exists
- existing `notes` remain unless the importer explicitly sets them

Recommendation:

- The importer should preserve existing `status` and `notes` when a row already exists, unless the user later requests full replacement behavior.

That avoids clobbering admin-maintained app fields during a re-import.

## Runtime Data Flow

### Add New Device

`Add New Device` should:

- submit to MySQL-backed `/api/devices`
- create a row using the same shared data structure consumed by inventory
- require:
  - `deviceId`
  - `department`
  - `status`
  - `os`
  - `ipMode`
  - `ipAddress` only when `ipMode = Manual`
- write new rows directly into MySQL

Important change:

- The add form should collect `deviceId` explicitly.
- The old generated `DEV-...` identity is removed for this migration because the user wants `deviceId` itself to be the primary key.

### Device Inventory

`Device Inventory` should:

- load data from `GET /api/devices`
- render the same records stored in MySQL
- allow editing of:
  - `status`
  - `assignedTo`
- keep `deviceId` immutable in the edit flows

### Dashboard

Dashboard device summary widgets should:

- read from the same MySQL-backed device list used by inventory
- stop using `MOCK_DEVICES`
- continue using demo ticket data for ticket widgets

## Assignment Editing

`assignedTo` must remain editable anytime without changing device identity.

For this migration, keep assignment simple:

- store current assignee as a single editable string field: `assignedTo`
- editing assignment updates only `assignedTo`
- `deviceId` never changes during assignment edits

The current inventory UI already edits assignment in a popup. That flow should be refit to update `assignedTo` in MySQL instead of mutating local mock state.

Deliberate simplification:

- do not add assignment-history tables in this migration
- remove or degrade any fake assignment-history UI that depends on mock-only data if necessary

## API Changes

`/api/devices` should support:

- `GET`
  - returns MySQL device rows
- `POST`
  - creates a new device row keyed by `deviceId`
- `PATCH` or route-specific update handlers
  - update `status`
  - update `assignedTo`

Validation rules:

- `deviceId` is required and must be unique
- `department` is required
- `status` must be one of:
  - `Active`
  - `Inactive`
  - `Out of Service`
- `ipMode` must be one of:
  - `Manual`
  - `DHCP`
- `ipAddress` is required only when `ipMode = Manual`
- `os` is required

## UI Impact

### Add New Device

Changes:

- replace generated/internal ID assumptions with explicit `deviceId` entry
- keep existing department, IP mode, IP address, OS, and status fields
- submit directly into MySQL-backed data

### Inventory

Changes:

- load from API instead of `MOCK_DEVICES`
- display `department` directly from the device row
- allow assignment edits against MySQL
- keep status editing in the popup and persist it via API

### Dashboard

Changes:

- replace `MOCK_DEVICES` usage with fetched device data
- keep ticket cards and ticket-related demo behavior unchanged

## Testing Strategy

Required test coverage:

- importer maps workbook columns to MySQL columns correctly
- importer skips note/footer/signature rows
- importer upserts by `deviceId`
- `POST /api/devices` rejects duplicate `deviceId`
- add form validation requires IP only for manual mode
- inventory status update persists without changing `deviceId`
- assignment update persists without changing `deviceId`
- dashboard summaries compute from API-loaded device data instead of mocks

Testing approach:

- unit tests for row normalization and import filtering
- repository tests for MySQL/file-independent transformation logic where possible
- view tests for add form and inventory helper behavior
- route tests only where they add useful coverage

## Migration Notes

Demo device data should be removed from runtime usage, but not necessarily deleted from the repo immediately if tests still need fixtures.

Practical approach:

- remove `MOCK_DEVICES` from app runtime paths
- keep dedicated test fixtures where needed
- keep `MOCK_TICKETS` intact

## Risks

1. Excel values are inconsistent and sometimes human-entered.
   - Mitigation: preserve raw workbook text where possible instead of over-normalizing.
2. Footer rows resemble data rows near the bottom of the sheet.
   - Mitigation: explicit skip rules based on `deviceId` and field patterns.
3. The current inventory UI expects richer mock-only fields.
   - Mitigation: trim unsupported fake detail states or provide empty-safe defaults.
4. MySQL schema drift from the current app contract.
   - Mitigation: define one shared device type and route all pages through it.

## Success Criteria

This migration is complete when:

- device pages no longer depend on `MOCK_DEVICES` at runtime
- the app imports from `F-IT-010 Rev.00(Update)`
- MySQL stores device records keyed by `deviceId`
- `Add New Device` writes to MySQL
- `Device Inventory` reads from MySQL
- dashboard device summaries read from MySQL
- `assignedTo` can be updated without changing `deviceId`
- ticket demo flows still work unchanged
