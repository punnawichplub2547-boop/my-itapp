-- Adds device_id to repair_tickets so tickets created from a specific inventory
-- device can be confirmed-matched in the Repair Log without relying on heuristics.
--
-- Run once against the target database before deploying the matching code changes.

ALTER TABLE repair_tickets
  ADD COLUMN device_id VARCHAR(100) NULL DEFAULT NULL AFTER id;
