import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { artworkStatusSnapshot, observedArtworkUri, imageArtworkCandidates, subscribeArtworkChanges } from '@/services/artwork-fallback';
import type { CrimsonSong } from '@/types/music';

/** Observe exactly the large/small cover the player renders, including retries. */
export function useDisplayedArtwork(song: CrimsonSong | null, dataSaver: boolean) {
  const primary = (dataSaver ? song?.imageSmall || song?.image : song?.image || song?.imageSmall) || '';
  const candidates = useMemo(() => primary ? imageArtworkCandidates(primary, song?.artwork) : [], [primary, song?.artwork]);
  const subscribe = useCallback((listener: () => void) => subscribeArtworkChanges((uri) => { if (candidates.includes(uri)) listener(); }), [candidates]);
  const snapshot = useCallback(() => artworkStatusSnapshot(candidates), [candidates]);
  const revision = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { primary, source: observedArtworkUri(candidates), revision };
}
