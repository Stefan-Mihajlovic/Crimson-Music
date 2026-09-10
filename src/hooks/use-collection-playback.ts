import { useCallback, useMemo } from 'react';

import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { CrimsonSong } from '@/services/music';

export function useCollectionPlayback(songs: CrimsonSong[], collectionSource: string, collectionId = '') {
  const { currentSong, playSong, source, togglePlay } = usePlayer();
  const status = usePlayerStatus();
  const active = useMemo(
    () => Boolean(
      currentSong
      && collectionSource
      && source === collectionSource
      && songs.some((song) => song.id === currentSong.id)
    ),
    [collectionSource, currentSong, songs, source],
  );
  const playing = active && status.playing;
  const loading = active && status.isBuffering;

  const toggleCollectionPlayback = useCallback(() => {
    if (active) {
      togglePlay();
      return;
    }
    if (songs[0]) playSong(songs[0], songs, collectionSource, collectionId);
  }, [active, collectionId, collectionSource, playSong, songs, togglePlay]);

  return {
    active,
    loading,
    playing,
    toggleCollectionPlayback,
  };
}
