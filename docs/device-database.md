# Device Inventory Database

## Recommendation

Use a relational database, preferably MySQL, for the corporate device inventory.

MySQL is the better fit because inventory records need strong data integrity: unique `deviceId` values, controlled device statuses, consistent workbook-backed fields, and transactional updates when assignment changes. Reporting and search also benefit from indexed columns such as `deviceId`, `department`, `deviceType`, and `status`.

MongoDB is useful when records vary heavily by asset class or when nested device telemetry changes shape often. For this app, the core device inventory fields are structured and business-critical, so relational constraints are more valuable than schema flexibility.

## Schema

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

`deviceId` is the primary key and stable application identity. Assignment is mutable metadata stored in `assignedTo`, so reassigning a device does not change its identity or API route.
