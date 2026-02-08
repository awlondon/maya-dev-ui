import { fetch } from 'undici';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('auth endpoints send credentialed CORS headers', async () => {
  const res = await fetch('https://api.dev.primarydesignco.com/me', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://dev.primarydesignco.com'
    }
  });

  assert.equal(
    res.headers.get('access-control-allow-origin'),
    'https://dev.primarydesignco.com'
  );

  assert.equal(
    res.headers.get('access-control-allow-credentials'),
    'true'
  );
});
