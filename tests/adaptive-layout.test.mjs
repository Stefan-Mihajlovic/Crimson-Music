import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playerPanes } from '../src/services/adaptive-layout.ts';
import { browseTileWidth, BROWSE_TILE_GAP } from '../src/styles/browse-tiles.ts';
const safe = { top: 59, bottom: 34, left: 0, right: 0 };
test('compact iPhone retains its single-pane layout and an unfolded square gains two panes', () => {
  assert.equal(playerPanes(393, 852, safe).mode, 'compact');
  const wide = playerPanes(800, 850, safe);
  assert.equal(wide.mode, 'wide');
  assert.ok(wide.artwork.x + wide.artwork.width < wide.controls.x);
  assert.equal(playerPanes(390, 850, safe).mode, 'compact');
});
test('book mode leaves the entire separating hinge and clearance free', () => {
  const fold = { orientation: 'vertical', x: 390, y: 0, width: 24, height: 900 };
  const { artwork, controls, mode } = playerPanes(820, 900, safe, fold);
  assert.equal(mode, 'book');
  assert.ok(artwork.x + artwork.width <= fold.x - 16);
  assert.ok(controls.x >= fold.x + fold.width + 16);
});
test('tabletop places art above the fold and scrollable controls below it', () => {
  const fold = { orientation: 'horizontal', x: 0, y: 420, width: 720, height: 12 };
  const { artwork, controls, mode } = playerPanes(720, 860, safe, fold);
  assert.equal(mode, 'tabletop');
  assert.ok(artwork.y + artwork.height < fold.y);
  assert.ok(controls.y > fold.y + fold.height);
  assert.ok(controls.y + controls.height <= 860 - safe.bottom);
});
test('asymmetric system controls and camera insets remain outside both panes', () => {
  const { artwork, controls } = playerPanes(852, 393, { ...safe, top: 0, left: 59, right: 36 });
  assert.ok(artwork.x >= 71);
  assert.ok(controls.x + controls.width <= 852 - 48);
});
test('stale or invalid folding bounds safely fall back to the current window', () => {
  assert.equal(playerPanes(390, 850, safe, { orientation: 'vertical', x: 900, y: 0, width: 20, height: 900 }).mode, 'compact');
  assert.equal(playerPanes(800, 850, safe, { orientation: 'horizontal', x: 0, y: NaN, width: 800, height: 0 }).mode, 'wide');
});
test('category tiles keep even column counts without exceeding the viewport', () => {
  for (const [width, columns] of [[393, 2], [800, 4], [1200, 6]]) {
    assert.equal(browseTileWidth(width) * columns + BROWSE_TILE_GAP * (columns - 1), width - 40);
  }
});
