import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newQueueEntry, normalizeQueueEntries, removeQueueEntry, restoreQueueEntry } from '../src/services/queue-entries.ts';
const song = (id) => ({ id, title: id });
test('duplicate songs have independent occurrence IDs which survive reordering', () => {
  const shared = newQueueEntry(song('same'));
  const entries = normalizeQueueEntries([shared, shared, song('last')]);
  assert.equal(new Set(entries.map((item) => item.queueEntryId)).size, 3);
  const moved = normalizeQueueEntries([entries[2], entries[0], entries[1]]);
  assert.equal(moved[1].queueEntryId, shared.queueEntryId);
});
test('Undo restores the removed occurrence between its neighbors without replacing newer queue edits', () => {
  const entries = normalizeQueueEntries(['a', 'same', 'same', 'd'].map(song));
  const result = removeQueueEntry(entries, 2, 0);
  const later = [...result.queue, newQueueEntry(song('new'), 'manual')];
  const restored = restoreQueueEntry(later, 0, result.removed);
  assert.deepEqual(restored.map((item) => item.id), ['a', 'same', 'same', 'd', 'new']);
  assert.equal(restored[2].queueEntryId, entries[2].queueEntryId);
  assert.equal(restoreQueueEntry(restored, 0, result.removed), restored);
});
test('Undo never inserts a removed song into already played history after playback advances', () => {
  const entries = normalizeQueueEntries(['a', 'b', 'c', 'd'].map(song));
  const result = removeQueueEntry(entries, 1, 0);
  assert.deepEqual(restoreQueueEntry(result.queue, 2, result.removed).map((item) => item.id), ['a', 'c', 'd', 'b']);
  for (const index of [-1, 0, 1.5, 99]) assert.equal(removeQueueEntry(entries, index, 0), null);
});
