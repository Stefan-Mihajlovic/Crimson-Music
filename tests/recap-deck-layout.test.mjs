import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recapDeckLayout } from '../src/components/recap-deck-layout.ts';

test('recap starts at the content gutter and every later card centers at its snap position', () => {
  for (const viewportWidth of [320, 393, 430, 768, 1024, 1440]) {
    const layout = recapDeckLayout(viewportWidth, 6);
    assert.equal(layout.leadingInset, 20);
    assert.equal(layout.snapOffsets[0], 0);
    let cardLeft = layout.leadingInset;
    for (let index = 1; index < layout.snapOffsets.length; index += 1) {
      cardLeft += layout.cardWidth + layout.gap + (index === 1 ? layout.firstGapExtra : 0);
      assert.ok(layout.snapOffsets[index] > layout.snapOffsets[index - 1]);
      const visibleCenter = cardLeft - layout.snapOffsets[index] + layout.cardWidth / 2;
      assert.equal(visibleCenter, viewportWidth / 2);
    }
    const maximumScroll = cardLeft + layout.cardWidth + layout.trailingInset - viewportWidth;
    assert.equal(layout.snapOffsets.at(-1), maximumScroll);
    assert.equal(viewportWidth / 2 + layout.firstCenterOffset, layout.leadingInset + layout.cardWidth / 2);
  }
});

test('phone recap keeps the compact card spacing and adjusts only its first swipe distance', () => {
  const layout = recapDeckLayout(393, 6);
  assert.equal(layout.cardWidth, 313);
  assert.equal(layout.firstGapExtra, 0);
  assert.deepEqual(layout.snapOffsets, [0, 305, 630, 955, 1280, 1605]);
});
