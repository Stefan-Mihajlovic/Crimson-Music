import assert from 'node:assert/strict';
import { test } from 'node:test';
import { networkIsOffline, networkRetryDelay, networkStatus } from '../src/services/network-state.ts';

test('unknown startup reachability does not block content, explicit disconnect does', () => {
  assert.equal(networkIsOffline({ isConnected: null, isInternetReachable: null }), false);
  assert.equal(networkIsOffline({ isConnected: true, isInternetReachable: null }), false);
  assert.equal(networkIsOffline({ isConnected: false, isInternetReachable: null }), true);
  assert.equal(networkIsOffline({ isConnected: true, isInternetReachable: false }), true);
  assert.equal(networkIsOffline({ isConnected: true, isInternetReachable: true }), false);
});

test('native uninitialized snapshots differ from a real disconnected interface', () => {
  assert.equal(networkStatus({ type: 'unknown', isConnected: false, isInternetReachable: false }), 'unknown');
  assert.equal(networkStatus({ type: 'none', isConnected: false, isInternetReachable: false }), 'offline');
  assert.equal(networkStatus({ type: 'wifi', isConnected: true, isInternetReachable: null }), 'unknown');
  // Some browsers expose Network Information API without an interface type.
  assert.equal(networkStatus({ type: 'unknown', isConnected: true, isInternetReachable: true }), 'online');
  assert.equal(networkStatus({ type: 'unknown', isConnected: true, isInternetReachable: false }), 'offline');
  assert.equal(networkStatus({ type: 'unknown', isConnected: false, isInternetReachable: null }, 'web'), 'offline');
});

test('offline retry backoff is bounded rather than polling every three seconds', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 100].map(networkRetryDelay), [5_000, 10_000, 20_000, 40_000, 60_000, 60_000]);
});
