import { test } from 'node:test';
import assert from 'node:assert/strict';
import { songSwipeDirection } from '../src/services/song-swipe.ts';
test('swipes commit deliberate distance or a short flick on either platform', () => {
  assert.equal(songSwipeDirection(-100, 0, 350, true, true), -1);
  assert.equal(songSwipeDirection(100, 0, 350, true, true), 1);
  assert.equal(songSwipeDirection(-20, -800, 350, true, true), -1);
  assert.equal(songSwipeDirection(8, 1000, 350, true, true), 0);
  assert.equal(songSwipeDirection(40, 0, 350, true, true), 0);
});
test('boundaries, reversals and invalid geometry do not skip tracks', () => {
  assert.equal(songSwipeDirection(-100, 800, 350, true, true), 0);
  assert.equal(songSwipeDirection(-100, -800, 350, true, false), 0);
  assert.equal(songSwipeDirection(100, 800, 350, false, true), 0);
  assert.equal(songSwipeDirection(100, 800, 0, true, true), 0);
  assert.equal(songSwipeDirection(NaN, 800, 350, true, true), 0);
});
