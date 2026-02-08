import { fetch, CookieJar } from 'undici';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const API = 'https://api.dev.primarydesignco.com';

test('google auth issues session and /me returns user', async () => {
  const jar = new CookieJar();

  const id_token = process.env.TEST_GOOGLE_ID_TOKEN;
  assert.ok(id_token, 'Missing TEST_GOOGLE_ID_TOKEN');

  const authRes = await fetch(`${API}/auth/google`, {
    method: 'POST',
    body: JSON.stringify({ id_token }),
    headers: { 'Content-Type': 'application/json' },
    dispatcher: jar
  });

  assert.equal(authRes.status, 200);

  const meRes = await fetch(`${API}/me`, {
    method: 'GET',
    dispatcher: jar
  });

  assert.equal(meRes.status, 200);

  const body = await meRes.json();
  assert.ok(body.user.email);
  assert.equal(body.user.provider, 'google');
});
