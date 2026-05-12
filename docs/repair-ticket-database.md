# Repair Ticket Database

Use this table for persisted repair tickets:

```sql
CREATE TABLE IF NOT EXISTS repair_tickets (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  device_name VARCHAR(200) NOT NULL,
  employee_name VARCHAR(160) NOT NULL,
  employee_email VARCHAR(200) NOT NULL,
  department VARCHAR(120) NOT NULL,
  problem_type VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('Pending', 'In Progress', 'Waiting for Parts', 'Completed', 'Closed') NOT NULL DEFAULT 'Pending',
  priority ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL DEFAULT 'Medium',
  created_at DATETIME NOT NULL,
  notes_json JSON NOT NULL,
  history_json JSON NOT NULL,
  attachments_json JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

Storage notes:

- `notes_json`, `history_json`, and `attachments_json` store the `RepairTicket` arrays as JSON.
- `id` keeps the existing `TK-...` format used by the app.
- `created_at` should be written as a UTC-safe MySQL `DATETIME` string in `YYYY-MM-DD HH:mm:ss` form.
- The service reads tickets newest-first by `created_at`.
- Status updates should run inside a transaction with `FOR UPDATE` row locking so concurrent history writes do not overwrite each other.
