import assert from 'node:assert/strict';
import test from 'node:test';

import { POST } from './route';

test('POST /api/reports/cleanup rejects unauthenticated requests', async () => {
  const response = await POST(
    new Request('http://localhost:3000/api/reports/cleanup', {
      method: 'POST',
    })
  );
  const body = (await response.json()) as { error?: string };

  assert.equal(response.status, 401);
  assert.match(body.error ?? '', /authentication required/i);
});
