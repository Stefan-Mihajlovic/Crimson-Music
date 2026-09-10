import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RequestCache } from '../src/services/request-cache.ts';

test('concurrent consumers share one request and subsequent reads use the cached result', async () => {
  const cache = new RequestCache();
  let calls = 0;
  const load = async () => { calls += 1; return { tracks: ['one'] }; };
  const values = await Promise.all(Array.from({ length: 20 }, () => cache.get('tracks', load, 1_000)));
  assert.equal(calls, 1);
  assert.equal(await cache.get('tracks', load, 1_000), values[0]);
  assert.equal(calls, 1);
});

test('failed requests can be retried and do not poison the cache', async () => {
  const cache = new RequestCache();
  await assert.rejects(cache.get('key', async () => { throw new Error('offline'); }));
  assert.equal(await cache.get('key', async () => 'recovered'), 'recovered');
});

test('LRU evicts unused values and expired entries reload', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: 1_000 });
  const cache = new RequestCache(2);
  await cache.get('a', async () => 'a', 100);
  await cache.get('b', async () => 'b', 100);
  await cache.get('a', async () => 'wrong', 100);
  await cache.get('c', async () => 'c', 100);
  assert.equal(await cache.get('b', async () => 'reloaded', 100), 'reloaded');
  context.mock.timers.tick(101);
  assert.equal(await cache.get('c', async () => 'expired', 100), 'expired');
});

test('clear prevents an outstanding request from repopulating deleted user data', async () => {
  const cache = new RequestCache();
  let finish;
  const pending = cache.get('account', () => new Promise((resolve) => { finish = resolve; }), 1_000);
  await Promise.resolve();
  cache.clear();
  finish('old');
  await pending;
  assert.equal(await cache.get('account', async () => 'new', 1_000), 'new');
});
