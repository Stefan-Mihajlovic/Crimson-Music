import AsyncStorage from '@react-native-async-storage/async-storage';

import { isAccountDeleted, registerAccountCleanup } from '@/services/account-lifecycle';
import type { CrimsonSong } from '@/types/music';

export type PlaybackSnapshot = {
  queue: CrimsonSong[];
  index: number;
  position: number;
  shuffled: boolean;
  repeat: 'none' | 'all' | 'one';
  source: string;
  sourceId: string;
  originalOrder?: string[];
};

const key = (uid: string) => `crimson.player.session.v1:${uid}`;
const progressKey = (uid: string) => `crimson.player.progress.v1:${uid}`;
const writes = new Map<string, Promise<void>>();
const savedQueues = new Map<string, CrimsonSong[]>();
const historyResetListeners = new Set<(uid: string) => void>();

export function resetPlayerListeningHistory(uid: string) {
  historyResetListeners.forEach((listener) => listener(uid));
}

export function subscribeToListeningHistoryReset(listener: (uid: string) => void) {
  historyResetListeners.add(listener);
  return () => { historyResetListeners.delete(listener); };
}

registerAccountCleanup(async (uid) => {
  await writes.get(uid)?.catch(() => undefined);
  savedQueues.delete(uid);
  await AsyncStorage.multiRemove([key(uid), progressKey(uid)]);
});

/** Serialized writes prevent a slower progress save from replacing a newer queue. */
export function savePlaybackSession(uid: string, snapshot: PlaybackSnapshot) {
  const { queue, ...progress } = snapshot;
  const serializedProgress = JSON.stringify(progress);
  const pending = (writes.get(uid) || Promise.resolve()).catch(() => undefined).then(async () => {
    if (isAccountDeleted(uid)) return;
    const entries: [string, string][] = [[progressKey(uid), serializedProgress]];
    // Position checkpoints are tiny. A large queue is serialized only when its
    // immutable array changes, rather than on every five-second progress save.
    if (savedQueues.get(uid) !== queue) entries.push([key(uid), JSON.stringify({ queue: queue.map((song) => ({ ...song, url: '' })) })]);
    await AsyncStorage.multiSet(entries);
    savedQueues.set(uid, queue);
  });
  writes.set(uid, pending);
  void pending.finally(() => { if (writes.get(uid) === pending) writes.delete(uid); }).catch(() => undefined);
  return pending;
}

export async function restorePlaybackSession(uid: string): Promise<PlaybackSnapshot | null> {
  try {
    const stored = await AsyncStorage.getItem(key(uid));
    if (!stored || isAccountDeleted(uid)) return null;
    const storedProgress = await AsyncStorage.getItem(progressKey(uid));
    const data = { ...JSON.parse(stored), ...(storedProgress ? JSON.parse(storedProgress) : {}) } as Partial<PlaybackSnapshot>;
    if (!Array.isArray(data.queue) || !data.queue.length || data.queue.length > 5000) return null;
    if (!data.queue.every((song) => song && typeof song.id === 'string' && song.source === 'audius'
      && typeof song.title === 'string' && typeof song.creator === 'string')) return null;
    const index = Number.isInteger(data.index) ? Number(data.index) : 0;
    if (index < 0 || index >= data.queue.length) return null;
    savedQueues.set(uid, data.queue);
    return {
      queue: data.queue,
      index,
      position: Number.isFinite(data.position) ? Math.max(0, Number(data.position)) : 0,
      shuffled: data.shuffled === true,
      repeat: data.repeat === 'all' || data.repeat === 'one' ? data.repeat : 'none',
      source: typeof data.source === 'string' ? data.source : 'Library',
      sourceId: typeof data.sourceId === 'string' ? data.sourceId : '',
      originalOrder: Array.isArray(data.originalOrder) && data.originalOrder.every((id) => typeof id === 'string')
        ? data.originalOrder.slice(0, 5000) : data.queue.map((song) => song.id),
    };
  } catch { return null; }
}

export function shuffledSongs(songs: CrimsonSong[]) {
  const result = [...songs];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

/** Accumulate playback movement, never seek jumps or time spent paused/buffering. */
export class ListeningClock {
  seconds = 0;
  private position: number | null = null;
  private sampledAt = 0;
  private playing = false;

  sample(position: number, playing: boolean, now = Date.now()) {
    if (this.position !== null && this.playing) {
      const elapsed = Math.max(0, (now - this.sampledAt) / 1000);
      const movement = position - this.position;
      if (movement >= 0 && movement <= elapsed + 0.75) this.seconds += Math.min(movement, elapsed + 0.1);
    }
    this.position = Number.isFinite(position) ? position : 0;
    this.sampledAt = now;
    this.playing = playing;
  }

  seek() { this.position = null; this.playing = false; }
}
