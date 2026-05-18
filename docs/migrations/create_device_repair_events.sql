-- Creates a persistent audit table for device repair history.
-- Events are written at ticket creation, status change, and deletion so that
-- the Inventory Detail > Repair Log remains intact even after a ticket is deleted.
--
-- Run once against the target database before deploying the matching code changes.

CREATE TABLE IF NOT EXISTS device_repair_events (
  id          VARCHAR(36)   NOT NULL,
  device_id   VARCHAR(100)  NOT NULL,
  ticket_id   VARCHAR(100)  NULL DEFAULT NULL,
  event_type  VARCHAR(50)   NOT NULL,
  title       VARCHAR(255)  NOT NULL,
  description TEXT          NULL DEFAULT NULL,
  problem_type VARCHAR(100) NULL DEFAULT NULL,
  status      VARCHAR(50)   NULL DEFAULT NULL,
  reported_by VARCHAR(255)  NULL DEFAULT NULL,
  technician  VARCHAR(255)  NULL DEFAULT NULL,
  created_by  VARCHAR(255)  NULL DEFAULT NULL,
  created_at  DATETIME      NOT NULL,
  source      VARCHAR(20)   NOT NULL DEFAULT 'ticket',
  PRIMARY KEY (id),
  INDEX idx_device_repair_events_device_id (device_id),
  INDEX idx_device_repair_events_ticket_id (ticket_id),
  INDEX idx_device_repair_events_created_at (created_at)
);
