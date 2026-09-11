import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import DetailSongRow from '../../src/components/detail-song-row';
import SongListRow from '../../src/components/song-list-row';

let mockWidth = 1440;
jest.mock('react-native-web/dist/exports/useWindowDimensions', () => () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native-web').View },
  useAnimatedStyle: (callback) => callback(),
  useSharedValue: (value) => ({ value }),
  withSpring: (value) => value,
  withTiming: (value) => value,
}));
jest.mock('../../src/components/app-symbol', () => ({ SymbolView: () => null }));
jest.mock('../../src/components/now-playing-artwork', () => () => null);
jest.mock('../../src/components/download-status-icon', () => () => null);
jest.mock('../../src/providers/player-provider', () => ({ usePlayer: () => ({ currentSong: null }) }));
jest.mock('../../src/providers/settings-provider', () => ({ useAppSettings: () => ({
  reduceMotion: true,
  colors: { text: '#fff', secondaryText: '#aaa', controlSurface: '#222', accentSoft: '#325' },
}) }));

let root;
let container;
const song = { id: 'song', title: 'Wildfire', creator: 'ZYRA', duration: 153 };
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

test.each([1440, 390])('collection rows keep menu and playback as separate buttons at %ipx', (width) => {
  mockWidth = width;
  const play = jest.fn(); const menu = jest.fn();
  act(() => root.render(<DetailSongRow song={song} onPress={play} onLongPress={menu} />));
  expect(container.querySelector('button button')).toBeNull();
  const more = container.querySelector('[aria-label="More options for Wildfire"]');
  act(() => more.click());
  expect(menu).toHaveBeenCalledTimes(1);
  expect(play).not.toHaveBeenCalled();
  act(() => container.querySelector('[aria-label="Play Wildfire by ZYRA"]').click());
  expect(play).toHaveBeenCalledTimes(1);
  expect(menu).toHaveBeenCalledTimes(1);
});

test.each([1440, 390])('home and search rows keep menu clicks from starting playback at %ipx', (width) => {
  mockWidth = width;
  const play = jest.fn(); const menu = jest.fn();
  act(() => root.render(<SongListRow song={song} onPress={play} onMenuPress={menu} />));
  expect(container.querySelector('button button')).toBeNull();
  act(() => container.querySelector('[aria-label="More options for Wildfire"]').click());
  expect(menu).toHaveBeenCalledTimes(1);
  expect(play).not.toHaveBeenCalled();
});
