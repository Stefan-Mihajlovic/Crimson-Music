import assert from 'node:assert/strict';
import { test } from 'node:test';
import { belongsToAccount } from '../src/services/account-storage.ts';
import { disposeDeletedAccount, isAccountDeleted, registerAccountCleanup } from '../src/services/account-lifecycle.ts';

test('account cleanup targets exact UID keys including private playlist caches', () => {
  assert.equal(belongsToAccount('crimson.downloads.manifest.v1:owner', 'owner'), true);
  assert.equal(belongsToAccount('crimson.offline.data.v1:playlist:owner:crimson:mix', 'owner'), true);
  assert.equal(belongsToAccount('crimson.offline.data.v1:playlist:owner2:crimson:mix', 'owner'), false);
  assert.equal(belongsToAccount('crimson.account.profile.v1:owner2', 'owner'), false);
  assert.equal(belongsToAccount('crimson.player.autoplay.v1', 'owner'), false);
});

test('deletion marks the account before draining work and awaits every cleanup', async () => {
  let finish;
  let completed = false;
  const unsubscribe = registerAccountCleanup((uid) => {
    assert.equal(isAccountDeleted(uid), true);
    return new Promise((resolve) => { finish = resolve; });
  });
  const pending = disposeDeletedAccount('deletion-test').then(() => { completed = true; });
  assert.equal(completed, false);
  finish();
  await pending;
  assert.equal(completed, true);
  unsubscribe();
});

test('Audius disconnect clears only that listener’s new cache and preferences keys', () => {
  for (const kind of ['home', 'library', 'favorites', 'history']) {
    assert.equal(belongsToAccount(`crimson.offline.data.v2:${kind}:audius-user`, 'audius-user'), true);
    assert.equal(belongsToAccount(`crimson.offline.data.v2:${kind}:audius-user2`, 'audius-user'), false);
  }
  assert.equal(belongsToAccount('crimson.audius.preferences.v1:audius-user', 'audius-user'), true);
  assert.equal(belongsToAccount('crimson.offline.data.v2:playlist:audius-user:playlist', 'audius-user'), true);
});
