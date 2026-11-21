import type { CrimsonSong } from '@/types/music';
export type QueueOrigin = 'collection' | 'manual' | 'autoplay';
let entrySequence = 0;
export function newQueueEntry(song: CrimsonSong, origin: QueueOrigin = 'collection'): CrimsonSong {
  return { ...song, queueEntryId: `${Date.now().toString(36)}-${++entrySequence}`, queueOrigin: origin };
}
export function normalizeQueueEntries(songs: CrimsonSong[]) {
  const seen = new Set<string>();
  return songs.map((song) => {
    const item = song.queueEntryId && !seen.has(song.queueEntryId) ? song : newQueueEntry(song, song.queueOrigin || 'collection');
    seen.add(item.queueEntryId!);
    return item;
  });
}
export type RemovedQueueEntry = { song: CrimsonSong; index: number; before?: string; after?: string };
export function removeQueueEntry(queue: CrimsonSong[], index: number, currentIndex: number) {
  if (!Number.isInteger(index) || index <= currentIndex || index >= queue.length) return null;
  return { queue: queue.filter((_, i) => i !== index), removed: { song: queue[index], index, before: queue[index - 1]?.queueEntryId, after: queue[index + 1]?.queueEntryId } };
}
export function restoreQueueEntry(queue: CrimsonSong[], currentIndex: number, removed: RemovedQueueEntry) {
  if (queue.some((song) => song.queueEntryId === removed.song.queueEntryId)) return queue;
  const after = removed.after ? queue.findIndex((song) => song.queueEntryId === removed.after) : -1;
  const before = removed.before ? queue.findIndex((song) => song.queueEntryId === removed.before) : -1;
  const index = Math.min(queue.length, Math.max(currentIndex + 1, after >= 0 ? after : before >= 0 ? before + 1 : removed.index));
  const restored = [...queue]; restored.splice(index, 0, removed.song); return restored;
}
export function queueOriginLabel(song: CrimsonSong) {
  return song.queueOrigin === 'manual' ? 'Added by you' : song.queueOrigin === 'autoplay' ? 'Autoplay' : '';
}
