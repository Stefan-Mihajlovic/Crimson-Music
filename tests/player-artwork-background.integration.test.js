import React from 'react';
import { AppState } from 'react-native';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import PlayerArtworkBackground from '../src/components/player-artwork-background';
import ArtworkImage from '../src/components/artwork-image';
import { getArtworkPalette } from '../src/services/artwork-palette';
import { fallbackArtworkPalette } from '../src/services/artwork-palette-colors';
import { clearFailedArtworkCache } from '../src/services/artwork-fallback';
import { withTiming } from 'react-native-reanimated';
let mockDataSaver = false;
let mockReduceMotion = true;
jest.mock('expo-image', () => ({ Image: 'ArtworkImage' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' }, cancelAnimation: jest.fn(), useReducedMotion: () => mockReduceMotion, useSharedValue: (value) => require('react').useRef({ value }).current, useAnimatedStyle: (callback) => callback(), Easing: { inOut: (value) => value, cubic: 'cubic', linear: 'linear' }, ReduceMotion: {}, withRepeat: jest.fn(), withTiming: jest.fn((value) => value) }));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (callback, ...args) => callback(...args) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Defs: 'Defs', RadialGradient: 'RadialGradient', Rect: 'Rect', Stop: 'Stop' }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ dataSaver: mockDataSaver, performanceMode: false, reduceMotion: mockReduceMotion }) }));
jest.mock('../src/services/artwork-palette', () => ({ fallbackArtworkPalette: require('../src/services/artwork-palette-colors').fallbackArtworkPalette, getCachedArtworkPalette: () => undefined, getArtworkPalette: jest.fn() }));
let root;
const image = 'https://cover.example/large.jpg';
const song = { id: 'song', image, imageSmall: 'https://cover.example/small.jpg' };
const colors = () => [...new Set(root.root.findAllByType('Stop').map((stop) => stop.props.stopColor))];
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; AppState.currentState = 'active'; mockDataSaver = false; mockReduceMotion = true; clearFailedArtworkCache(); getArtworkPalette.mockResolvedValue(['#12802A', '#267742', '#36856A']); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = undefined; });

test('a song without artwork immediately renders the bundled purple palette without a palette download', async () => {
  await act(async () => { root = create(<PlayerArtworkBackground active song={{ id: 'local:no-art', image: '', imageSmall: '' }} />); });
  expect(colors()).toEqual(fallbackArtworkPalette);
  expect(getArtworkPalette).not.toHaveBeenCalled();
});

test('a failed displayed cover switches its background from extracted colors to the shown fallback artwork', async () => {
  await act(async () => { root = create(<><PlayerArtworkBackground active song={song} /><ArtworkImage source={{ uri: image }} /></>); });
  expect(colors()).toEqual(['#12802A', '#267742', '#36856A']);
  await act(async () => root.root.findByType('ArtworkImage').props.onError({ error: 'cover unavailable' }));
  expect(colors()).toEqual(fallbackArtworkPalette);
});

test('Data Saver waits for an image load before retrying cache-only extraction and never enables network requests', async () => {
  mockDataSaver = true;
  getArtworkPalette.mockResolvedValueOnce(null).mockResolvedValue(['#12802A', '#267742', '#36856A']);
  await act(async () => { root = create(<><PlayerArtworkBackground active song={song} /><ArtworkImage source={{ uri: song.imageSmall }} /></>); });
  expect(colors()).toEqual(fallbackArtworkPalette);
  await act(async () => root.root.findByType('ArtworkImage').props.onLoad({}));
  expect(colors()).toEqual(['#12802A', '#267742', '#36856A']);
  expect(getArtworkPalette.mock.calls).toHaveLength(2);
  for (const [source, options] of getArtworkPalette.mock.calls) { expect(source).toBe(song.imageSmall); expect(options.allowNetwork).toBe(false); }
});

test('a collapsed player prepares each new track palette before opening, without an opening color fade', async () => {
  mockReduceMotion = false;
  await act(async () => { root = create(<PlayerArtworkBackground active={false} song={song} />); });
  expect(colors()).toEqual(['#12802A', '#267742', '#36856A']);
  const nextSong = { id: 'next', image: 'https://cover.example/next.jpg' };
  getArtworkPalette.mockResolvedValue(['#813628', '#BB5331', '#963218']);
  await act(async () => root.update(<PlayerArtworkBackground active={false} song={nextSong} />));
  expect(colors()).toEqual(['#813628', '#BB5331', '#963218']);
  const requests = getArtworkPalette.mock.calls.length;
  await act(async () => root.update(<PlayerArtworkBackground active song={nextSong} />));
  expect(getArtworkPalette).toHaveBeenCalledTimes(requests);
  expect(withTiming.mock.calls.filter(([, options]) => options.duration === 1100)).toHaveLength(0);
});

test('opening during a pending hidden palette request neither restarts it nor fades from the old track', async () => {
  mockReduceMotion = false;
  let resolvePalette;
  getArtworkPalette.mockReturnValue(new Promise((resolve) => { resolvePalette = resolve; }));
  await act(async () => { root = create(<PlayerArtworkBackground active={false} song={song} />); });
  await act(async () => root.update(<PlayerArtworkBackground active song={song} />));
  expect(getArtworkPalette).toHaveBeenCalledTimes(1);
  await act(async () => resolvePalette(['#12802A', '#267742', '#36856A']));
  expect(colors()).toEqual(['#12802A', '#267742', '#36856A']);
  expect(withTiming.mock.calls.filter(([, options]) => options.duration === 1100)).toHaveLength(0);
});

test('an expanded artwork load cannot turn a pending collapsed color update into an opening fade', async () => {
  mockReduceMotion = false;
  let resolvePalette;
  const pending = new Promise((resolve) => { resolvePalette = resolve; });
  getArtworkPalette.mockReturnValue(pending);
  await act(async () => { root = create(<PlayerArtworkBackground active={false} song={song} />); });
  await act(async () => root.update(<PlayerArtworkBackground active song={song} />));
  await act(async () => root.update(<PlayerArtworkBackground active artworkLoaded={1} song={song} />));
  await act(async () => resolvePalette(['#12802A', '#267742', '#36856A']));
  expect(colors()).toEqual(['#12802A', '#267742', '#36856A']);
  expect(withTiming.mock.calls.filter(([, options]) => options.duration === 1100)).toHaveLength(0);
});

test('slow palette results for a skipped track cannot overwrite the current collapsed track colors', async () => {
  let resolveOld;
  getArtworkPalette.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  await act(async () => { root = create(<PlayerArtworkBackground active={false} song={song} />); });
  const nextSong = { id: 'next', image: 'https://cover.example/next.jpg' };
  getArtworkPalette.mockResolvedValue(['#813628', '#BB5331', '#963218']);
  await act(async () => root.update(<PlayerArtworkBackground active={false} song={nextSong} />));
  await act(async () => resolveOld(['#12802A', '#267742', '#36856A']));
  expect(colors()).toEqual(['#813628', '#BB5331', '#963218']);
});

test('track changes while the player is open still blend between artwork palettes', async () => {
  mockReduceMotion = false;
  await act(async () => { root = create(<PlayerArtworkBackground active song={song} />); });
  withTiming.mockClear();
  getArtworkPalette.mockResolvedValue(['#813628', '#BB5331', '#963218']);
  await act(async () => root.update(<PlayerArtworkBackground active song={{ id: 'next', image: 'https://cover.example/next.jpg' }} />));
  expect(withTiming.mock.calls.filter(([, options]) => options.duration === 1100)).toHaveLength(1);
});
