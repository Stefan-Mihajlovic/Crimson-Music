import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compactHeaderProgress, expandedHeaderOpacity } from '../src/services/main-header-transition.ts';

test('header transition stays continuous and reverses with the scroll rather than snapping at one offset', () => {
  const forwards = Array.from({ length: 101 }, (_, offset) => compactHeaderProgress(offset));
  for (let index = 1; index < forwards.length; index += 1) {
    assert.ok(forwards[index] >= forwards[index - 1]);
    assert.ok(forwards[index] - forwards[index - 1] < 0.03);
  }
  const backwards = Array.from({ length: 101 }, (_, index) => compactHeaderProgress(100 - index));
  assert.deepEqual(backwards, forwards.toReversed());
  assert.equal(compactHeaderProgress(0), 0);
  assert.equal(compactHeaderProgress(100), 1);
  assert.equal(expandedHeaderOpacity(0), 1);
  assert.equal(expandedHeaderOpacity(100), 0);
});

test('overscroll and long lists keep header opacity bounded', () => {
  for (const offset of [-100, -1, 0, 10, 50, 100, 5000]) {
    for (const opacity of [compactHeaderProgress(offset), expandedHeaderOpacity(offset)]) {
      assert.ok(opacity >= 0 && opacity <= 1);
    }
  }
});
