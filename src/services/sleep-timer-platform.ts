import type { AudioPlayer } from 'expo-audio';

/** Optional methods added to Expo Audio's persistent raw decks by the native adapter. */
export type NativeSleepTimerDeck = {
  setCrimsonSleepTimer?: (deadlineAt: number) => void;
  crimsonSleepTimerExpiredAt?: number;
};

export function setNativeSleepDeadline(players: readonly AudioPlayer[], deadlineAt: number): boolean {
  const unique = [...new Set(players)] as (AudioPlayer & NativeSleepTimerDeck)[];
  let supported = unique.length > 0;
  // Clear every surviving deck even if the hook released another one first.
  for (const deck of unique) {
    try {
      if (typeof deck.setCrimsonSleepTimer !== 'function') supported = false;
      else deck.setCrimsonSleepTimer(deadlineAt);
    } catch { supported = false; }
  }
  if (!supported && deadlineAt > 0) {
    // Do not leave just one half of a crossfade armed when the other failed.
    for (const deck of unique) { try { deck.setCrimsonSleepTimer?.(0); } catch { /* Already released. */ } }
  }
  return supported;
}

export function nativeSleepExpired(players: readonly AudioPlayer[], deadlineAt: number): boolean {
  return deadlineAt > 0 && players.some((deck) => {
    try { return (deck as AudioPlayer & NativeSleepTimerDeck).crimsonSleepTimerExpiredAt === deadlineAt; }
    catch { return false; }
  });
}
