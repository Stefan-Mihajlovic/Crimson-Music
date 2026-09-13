import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudiusSessionClient, accountFromResponse, sessionWithTokens } from '../src/services/audius-session-core.ts';

const account = { id: 'eP9k2', handle: 'listener', name: 'Listener', picture: '' };
const session = (patch = {}) => ({ accessToken: 'listener-access', refreshToken: 'listener-refresh', expiresAt: null, refreshExpiresAt: null, clientId: 'public-app-identity', scope: 'write', account, ...patch });
function fixture(transport) {
  let saved = null;
  return { client: new AudiusSessionClient({ read: async () => saved, write: async (value) => { saved = value; } }, transport), saved: () => saved };
}
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { resolve, promise }; }

test('music and library requests use the listener token without the app API key', async () => {
  const calls = [];
  const { client } = fixture(async (url, init) => { calls.push({ url, init }); return json({ data: [] }); });
  await client.establish(session(), 0);
  await client.request('/tracks/trending');
  await client.request('/tracks/abc/favorites?user_id=eP9k2', { method: 'POST' });
  for (const { url, init } of calls) {
    assert.equal(init.headers.Authorization, 'Bearer listener-access');
    assert.equal(new Headers(init.headers).has('x-api-key'), false);
    assert.equal(url.includes('api_key'), false);
    assert.equal(new URL(url).searchParams.get('user_id'), account.id);
    assert.equal(JSON.stringify(init).includes('public-app-identity'), false);
  }
});

test('concurrent expired requests share one token refresh and retry with the rotated token', async () => {
  const gate = deferred();
  let refreshes = 0;
  const { client, saved } = fixture(async (url, init) => {
    if (url.endsWith('/oauth/token')) { refreshes++; await gate.promise; return json({ access_token: 'rotated', refresh_token: 'rotated-refresh', expires_in: 3600 }); }
    return init.headers.Authorization === 'Bearer rotated' ? json({ data: [] }) : json({}, 401);
  });
  await client.establish(session(), 0);
  const first = client.request('/tracks/trending');
  const second = client.request('/users/eP9k2/favorites');
  await new Promise((resolve) => setTimeout(resolve, 5));
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(refreshes, 1);
  assert.equal(JSON.parse(saved()).refreshToken, 'rotated-refresh');
});

test('logout during refresh cannot restore an old account or persist its new tokens', async () => {
  const gate = deferred();
  const started = deferred();
  const { client, saved } = fixture(async (url) => {
    if (url.endsWith('/oauth/token')) { started.resolve(); await gate.promise; return json({ access_token: 'late', refresh_token: 'late-refresh' }); }
    return json({}, 401);
  });
  await client.establish(session({ expiresAt: 1 }), 0);
  const request = client.request('/me');
  await started.promise;
  await client.clear();
  gate.resolve();
  await assert.rejects(request, { code: 'cancelled' });
  assert.equal(client.current(), null);
  assert.equal(saved(), null);
});

test('revoked refresh token clears the session and informs the UI', async () => {
  const { client, saved } = fixture(async () => json({}, 401));
  await client.establish(session(), 0);
  let cleared = false;
  client.subscribe(() => { if (!client.current()) cleared = true; });
  await assert.rejects(client.request('/me'), { code: 'unauthenticated' });
  assert.equal(saved(), null);
  assert.equal(cleared, true);
});

test('transient refresh failure keeps the stored session available for retry/offline use', async () => {
  const { client, saved } = fixture(async () => json({}, 503));
  await client.establish(session({ expiresAt: 1 }), 0);
  await assert.rejects(client.request('/me'), { code: 'network' });
  assert.equal(client.current().account.id, account.id);
  assert.ok(saved());
});

test('refuses external URLs before a bearer token can be sent', async () => {
  let called = false;
  const { client } = fixture(async () => { called = true; return json({}); });
  await client.establish(session(), 0);
  await assert.rejects(client.request('https://attacker.example/steal'));
  await assert.rejects(client.request('//attacker.example/steal'));
  await assert.rejects(client.request('/../../other'));
  assert.equal(called, false);
});

test('late persisted session reads cannot overwrite an explicit login', async () => {
  const gate = deferred();
  const client = new AudiusSessionClient({ read: () => gate.promise, write: async () => {} }, async () => json({}));
  const restore = client.restore();
  await client.establish(session(), 0);
  gate.resolve(JSON.stringify(session({ account: { ...account, id: 'old' } })));
  await restore;
  assert.equal(client.current().account.id, account.id);
});

test('OAuth profile parser requires encoded REST user identity and maps artwork', () => {
  assert.deepEqual(accountFromResponse({ data: { id: 'encoded', handle: 'artist', name: 'Artist', profile_picture: { '480x480': 'https://img.test/a.jpg' } } }), { id: 'encoded', handle: 'artist', name: 'Artist', picture: 'https://img.test/a.jpg' });
  assert.throws(() => accountFromResponse({ userId: 42, handle: 'artist' }));
  assert.throws(() => sessionWithTokens({ access_token: 'incomplete' }, { account, clientId: 'app', scope: 'write' }));
});

test('logout before a write starts prevents the old bearer request from being sent', async () => {
  let called = false;
  const { client } = fixture(async () => { called = true; return json({}); });
  await client.establish(session(), 0);
  const write = client.request('/tracks/song/favorites?user_id=eP9k2', { method: 'POST' });
  await client.clear();
  await assert.rejects(write, { code: 'cancelled' });
  assert.equal(called, false);
});

test('a repeated restore cannot replace a rotated refresh token with old disk data', async () => {
  let stored = JSON.stringify(session({ expiresAt: 1 }));
  let reads = 0;
  const client = new AudiusSessionClient({ read: async () => { reads++; return stored; }, write: async (v) => { stored = v; } }, async () => json({ access_token: 'rotated', refresh_token: 'rotated-refresh', expires_in: 3600 }));
  await client.restore();
  await client.accessToken();
  await client.restore();
  assert.equal(reads, 1);
  assert.equal(client.current().refreshToken, 'rotated-refresh');
});

test('a profile read started before Save cannot overwrite the confirmed name and photo', async () => {
  const { client, saved } = fixture(async () => json({}));
  await client.establish(session(), 0);
  const revision = client.version();
  const beforeSave = client.current().account;
  const edited = { ...account, name: 'Updated name', picture: 'https://images.example/new.jpg' };
  await client.updateAccount(edited, revision);
  const lateRead = await client.updateAccount({ ...beforeSave }, revision, beforeSave);
  assert.deepEqual(lateRead, edited);
  assert.deepEqual(client.current().account, edited);
  assert.deepEqual(JSON.parse(saved()).account, edited);
  // A later read still refreshes the profile once no edit has overtaken it.
  const fresh = { ...edited, name: 'Changed in Audius' };
  await client.updateAccount(fresh, revision, edited);
  assert.deepEqual(client.current().account, fresh);
});

test('token refresh overlapping Save preserves the edited profile and rotated credentials', async () => {
  const gate = deferred();
  const started = deferred();
  const { client, saved } = fixture(async () => {
    started.resolve();
    await gate.promise;
    return json({ access_token: 'rotated', refresh_token: 'rotated-refresh', expires_in: 3600 });
  });
  await client.establish(session({ expiresAt: 1 }), 0);
  const refreshing = client.accessToken();
  await started.promise;
  const edited = { ...account, name: 'Saved name', picture: 'https://images.example/saved.jpg' };
  await client.updateAccount(edited, client.version());
  gate.resolve();
  assert.equal(await refreshing, 'rotated');
  assert.deepEqual(client.current().account, edited);
  assert.deepEqual(JSON.parse(saved()).account, edited);
  assert.equal(JSON.parse(saved()).refreshToken, 'rotated-refresh');
});

test('a profile commit from a previous session cannot alter a newly connected account', async () => {
  const { client, saved } = fixture(async () => json({}));
  await client.establish(session(), 0);
  const revision = client.version();
  const next = { ...account, id: 'other', name: 'Other listener' };
  await client.establish(session({ account: next }), revision);
  await assert.rejects(client.updateAccount({ ...account, name: 'Late save' }, revision), { code: 'cancelled' });
  assert.deepEqual(JSON.parse(saved()).account, next);
});
