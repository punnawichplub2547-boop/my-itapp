import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { loadDeviceImportEnvironment } from './importEnvironment';

test('loads device import environment values from .env.local', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'repairlink-import-env-'));

  try {
    await writeFile(
      join(directory, '.env.local'),
      'DEVICE_REPOSITORY="mysql"\nDATABASE_URL="mysql://root:car1996@localhost:3306/repairlink"\n',
      'utf8'
    );

    const env = { NODE_ENV: 'test' } as NodeJS.ProcessEnv;
    loadDeviceImportEnvironment(directory, env);

    assert.equal(env.DEVICE_REPOSITORY, 'mysql');
    assert.equal(env.DATABASE_URL, 'mysql://root:car1996@localhost:3306/repairlink');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('does not override existing device import environment values', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'repairlink-import-env-'));

  try {
    await writeFile(
      join(directory, '.env.local'),
      'DATABASE_URL="mysql://root:car1996@localhost:3306/repairlink"\n',
      'utf8'
    );

    const env = {
      NODE_ENV: 'test',
      DATABASE_URL: 'mysql://override-user:override-pass@localhost:3306/otherdb',
    } as NodeJS.ProcessEnv;

    loadDeviceImportEnvironment(directory, env);

    assert.equal(
      env.DATABASE_URL,
      'mysql://override-user:override-pass@localhost:3306/otherdb'
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
