import { NativeModules, Platform } from 'react-native';

import type { CrimsonSong } from '@/types/music';

export type WidgetSnapshot = {
  version: 1;
  signedIn: boolean;
  title: string;
  artist: string;
  artworkUrl: string;
  playing: boolean;
  hasTrack: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
  source: string;
  nextTitle: string;
  updatedAt: number;
};

export function createWidgetSnapshot(options: {
  signedIn: boolean;
  song: CrimsonSong | null;
  playing: boolean;
  nextSong: CrimsonSong | null;
  previousSong: CrimsonSong | null;
  source: string;
}): WidgetSnapshot {
  const song = options.signedIn ? options.song : null;
  return {
    version: 1,
    signedIn: options.signedIn,
    title: song?.title || 'Your music, ready',
    artist: song?.creator || (options.signedIn ? 'Open Crimson and find your next favorite' : 'Sign in to Crimson to start listening'),
    artworkUrl: song?.imageSmall || song?.image || '',
    playing: Boolean(song && options.playing),
    hasTrack: Boolean(song),
    canGoNext: Boolean(song && options.nextSong),
    canGoPrevious: Boolean(song && options.previousSong),
    source: song ? options.source : '',
    nextTitle: song ? options.nextSong?.title || '' : '',
    updatedAt: Date.now(),
  };
}

/** Native widgets receive only display metadata, never credentials or stream URLs. */
export async function updateWidgets(snapshot: WidgetSnapshot) {
  if (Platform.OS === 'web') return;
  const bridge = NativeModules.CrimsonWidgets as { updateSnapshot?: (json: string) => Promise<void> } | undefined;
  await bridge?.updateSnapshot?.(JSON.stringify(snapshot));
}
