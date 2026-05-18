# Repair Ticket Database

Use this table for persisted repair tickets.

## Recommended Schema

```sql
CREATE TABLE IF NOT EXISTS repair_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(120) NULL,
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
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  KEY idx_repair_tickets_created_at (created_at),
  KEY idx_repair_tickets_completed_at (completed_at),
  KEY idx_repair_tickets_device_id (device_id)
);
```

## Storage Notes

- `id` is an auto-increment numeric primary key in the current MySQL flow.
- The app reads `result.insertId` after insert, then converts it to a string in the API layer.
- `device_id` is optional, but should be stored when a ticket is created from a known device.
- `notes_json`, `history_json`, and `attachments_json` store the related arrays as JSON.
- `created_at` should be written as a UTC-safe MySQL `DATETIME` string in `YYYY-MM-DD HH:mm:ss` format.
- `completed_at` is set when a ticket moves to `Completed` or `Closed`.
- The service reads tickets newest-first by `created_at DESC, id DESC`.
- Status transitions run inside a transaction with `FOR UPDATE` row locking.
