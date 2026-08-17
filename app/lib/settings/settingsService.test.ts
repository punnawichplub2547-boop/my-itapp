import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SYSTEM_SETTINGS,
  InMemorySettingsRepository,
  normalizeSettingsPayload,
} from './settingsService';

test('normalizeSettingsPayload returns defaults when given invalid input', () => {
  const settings = normalizeSettingsPayload(null);
  assert.deepEqual(settings, DEFAULT_SYSTEM_SETTINGS);
});

test('normalizeSettingsPayload deduplicates and cleans string lists', () => {
  const result = normalizeSettingsPayload({
    departments: [' IT ', 'HR', 'IT', ''],
    problemTypes: ['Hardware', 'Hardware'],
    warrantyExpiringSoonDays: 45,
  });

  assert.deepEqual(result.departments, ['IT', 'HR']);
  assert.deepEqual(result.problemTypes, ['Hardware']);
  assert.equal(result.warrantyExpiringSoonDays, 45);
});

test('normalizeSettingsPayload rejects invalid warranty days and falls back to default', () => {
  const result = normalizeSettingsPayload({
    warrantyExpiringSoonDays: -5,
  });
  assert.equal(result.warrantyExpiringSoonDays, DEFAULT_SYSTEM_SETTINGS.warrantyExpiringSoonDays);
});

test('InMemorySettingsRepository gets defaults, updates partially, and resets', async () => {
  const repo = new InMemorySettingsRepository();
  const initial = await repo.getSettings();
  assert.deepEqual(initial, DEFAULT_SYSTEM_SETTINGS);

  const updated = await repo.updateSettings({
    departments: ['IT', 'NEW_DEPT'],
    warrantyExpiringSoonDays: 60,
  });

  assert.deepEqual(updated.departments, ['IT', 'NEW_DEPT']);
  assert.equal(updated.warrantyExpiringSoonDays, 60);
  assert.deepEqual(updated.problemTypes, DEFAULT_SYSTEM_SETTINGS.problemTypes);

  // Reset single key
  const resetDept = await repo.resetSettings(['departments']);
  assert.deepEqual(resetDept.departments, DEFAULT_SYSTEM_SETTINGS.departments);
  assert.equal(resetDept.warrantyExpiringSoonDays, 60);

  // Reset all
  const resetAll = await repo.resetSettings();
  assert.deepEqual(resetAll, DEFAULT_SYSTEM_SETTINGS);
});
