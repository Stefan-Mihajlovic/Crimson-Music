import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VisualizerResponse } from '../src/services/visualizer-response.ts';

test('a quiet melodic partial has visible regional motion instead of being averaged away', () => {
  const levels = Array(16).fill(0);
  levels[8] = 0.25;
  const result = new VisualizerResponse().next(levels);
  assert.ok(result[17] > 0.3);
  assert.equal(result[16], 0);
  assert.equal(result[18], 0);
  assert.equal(result[19], 0);
});

test('bass transients pulse once while a sustained note settles, and silence resets the response', () => {
  const levels = Array(16).fill(0);
  levels[2] = 0.8;
  const response = new VisualizerResponse();
  const attack = response.next(levels);
  assert.ok(attack[16] > 0.7);
  assert.ok(attack[19] > 0.8);
  let steady;
  for (let i = 0; i < 25; i++) steady = response.next(levels);
  assert.equal(steady[16], attack[16]);
  assert.ok(steady[19] < 0.001);
  assert.deepEqual(response.next(Array(16).fill(0)), Array(20).fill(0));
  assert.deepEqual(response.next(levels), attack);
});

test('invalid and oversized input cannot produce non-finite animated transforms', () => {
  const response = new VisualizerResponse();
  const result = response.next([NaN, Infinity, -1, 20, undefined]);
  assert.equal(result.length, 20);
  assert.ok(result.every((value) => Number.isFinite(value) && value >= 0 && value <= 1));
  assert.deepEqual(response.next([]), Array(20).fill(0));
});
