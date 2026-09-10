import assert from 'node:assert/strict';
import { test } from 'node:test';
import { networkIsOffline, networkRetryDelay } from '../src/services/network-state.ts';

test('unknown startup reachability does not block content, explicit disconnect does', () => {
  assert.equal(networkIsOffline({ isConnected: null, isInternetReachable: null }), false);
  assert.equal(networkIsOffline({ isConnected: true, isInternetReachable: null }), false);
  assert.equal(networkIsOffline({ isConnected: false, isInternetReachable: null }), true);
  assert.equal(networkIsOffline({ isConnected: true, isInternetReachable: false }), true);
  assert.equal(networkIsOffline({ isConnected: true, isInternetReachable: true }), false);
});

test('offline retry backoff is bounded rather than polling every three seconds', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 100].map(networkRetryDelay), [5_000, 10_000, 20_000, 40_000, 60_000, 60_000]);
});
