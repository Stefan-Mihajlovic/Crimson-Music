import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePlaybackSpeed } from '../src/services/playback-controls.ts';
test('playback speed restores safely and clamps to the supported range', () => {
  for (const value of [undefined, null, NaN, Infinity, '1.5']) assert.equal(normalizePlaybackSpeed(value), 1);
  assert.equal(normalizePlaybackSpeed(-1), .5);
  assert.equal(normalizePlaybackSpeed(3), 2);
  assert.equal(normalizePlaybackSpeed(1.2500001), 1.25);
});
