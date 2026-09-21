import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlayerProvider, usePlayer } from '../src/providers/player-provider';
import { resolveTrackPlaybackUrl } from '../src/services/music';

let mockDecks;
let mockDeckIndex;
let mockCrossfade;
let mockPlayback = {};
let root, player;
function mockDeck(id) {
  return {
    id, isLoaded: true, isBuffering: false, playing: false, volume: 1, currentTime: 0, duration: 120,
    isAudioSamplingSupported: false,
    play: jest.fn(function () { this.playing = true; }),
    pause: jest.fn(function () { this.playing = false; }),
    replace: jest.fn(function () { this.currentTime = 0; this.playing = false; this.isLoaded = true; }),
    seekTo: jest.fn(async function (position) { this.currentTime = position; }),
    setActiveForLockScreen: jest.fn(), clearLockScreenControls: jest.fn(), setAudioSamplingEnabled: jest.fn(), setPlaybackRate: jest.fn(), setCrimsonNormalization: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  };
}
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => require('react').useState(() => mockDecks[mockDeckIndex++])[0],
  useAudioPlayerStatus: (deck) => ({ id: deck.id, playing: deck.playing, isLoaded: deck.isLoaded, isBuffering: deck.isBuffering, currentTime: deck.currentTime, duration: deck.duration, didJustFinish: false }),
  setAudioModeAsync: jest.fn(async () => undefined),
}));
const mockGetPlaybackUri = () => null;
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { uid: 'listener' } }) }));
jest.mock('../src/providers/download-provider', () => ({ useDownloads: () => ({ getPlaybackUri: mockGetPlaybackUri }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ ...mockPlayback, crossfadeEnabled: mockCrossfade, crossfadeSeconds: 6, reduceMotion: true, performanceMode: true }) }));
jest.mock('../src/services/remote-controls', () => ({ configureRemoteControls: jest.fn(), subscribeToRemoteControls: () => () => {} }));
jest.mock('../src/services/audius-session', () => ({ audiusMediaHeaders: jest.fn(async () => undefined) }));
jest.mock('../src/services/music', () => ({
  getUserCollectionState: jest.fn(async () => false), loadRelatedSongs: jest.fn(async () => []),
  normalizeRemoteImageUrl: (url) => url, recordListeningEvent: jest.fn(async () => undefined),
  resolveTrackPlaybackUrl: jest.fn(async (song) => `https://example.test/${song.id}.mp3`),
  toggleUserCollectionItem: jest.fn(async () => true),
}));

function Probe() { player = usePlayer(); return null; }
const tree = () => React.createElement(PlayerProvider, null, React.createElement(Probe));
const song = (id) => ({ id, title: id, creator: 'Artist', source: 'audius', duration: 120, image: '', imageSmall: '', streamable: true });
async function position(deck, seconds) {
  deck.currentTime = seconds;
  await act(async () => root.update(tree()));
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  await AsyncStorage.clear();
  mockDecks = [mockDeck(1), mockDeck(2)];
  mockDeckIndex = 0;
  mockCrossfade = true;
  mockPlayback = {};
  await act(async () => { root = create(tree()); });
  await act(async () => player.playSong(song('a'), [song('a'), song('b'), song('c')], 'Test'));
});

afterEach(async () => {
  await act(async () => root.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('natural crossfade advances the shared queue once while both songs overlap', async () => {
  await position(mockDecks[0], 102);
  expect(mockDecks[1].replace).toHaveBeenCalledWith(expect.objectContaining({ uri: 'https://example.test/b.mp3' }));
  expect(player.currentSong.id).toBe('a');
  await position(mockDecks[0], 115);
  expect(player.currentSong.id).toBe('b');
  expect(player.queueIndex).toBe(1);
  expect(player.queue.map((track) => track.id)).toEqual(['a', 'b', 'c']);
  expect(mockDecks.every((deck) => deck.playing)).toBe(true);
  await position(mockDecks[1], 2.5);
  expect(mockDecks[0].volume).toBeCloseTo(0.5);
  expect(mockDecks[1].volume).toBeCloseTo(0.5);
  await act(async () => player.togglePlay());
  expect(mockDecks.every((deck) => !deck.playing)).toBe(true);
  expect(player.currentSong.id).toBe('b');
  await act(async () => player.playNext());
  expect(player.currentSong.id).toBe('c');
  expect(mockDecks[0].playing).toBe(false);
  expect(mockDecks[1].volume).toBe(1);
});

test('off and repeat-one do not preload or prematurely advance the queue', async () => {
  mockCrossfade = false;
  await position(mockDecks[0], 116);
  expect(player.currentSong.id).toBe('a');
  expect(mockDecks[1].replace).not.toHaveBeenCalled();
  mockCrossfade = true;
  mockPlayback = {};
  await act(async () => { player.toggleRepeat(); player.toggleRepeat(); });
  await position(mockDecks[0], 117);
  expect(player.repeatMode).toBe('one');
  expect(player.currentSong.id).toBe('a');
  expect(mockDecks[1].replace).not.toHaveBeenCalled();
});

test('a late next-song preload cannot replace a new queue selection', async () => {
  let finish;
  resolveTrackPlaybackUrl.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await position(mockDecks[0], 103);
  await act(async () => player.playSong(song('chosen')));
  await act(async () => finish('https://example.test/stale.mp3'));
  expect(player.currentSong.id).toBe('chosen');
  expect(mockDecks[1].replace).not.toHaveBeenCalledWith(expect.objectContaining({ uri: 'https://example.test/stale.mp3' }));
});


test('speed, pitch and normalization apply to both decks and survive handoff', async () => {
  mockPlayback = { playbackSpeed: 1.5, preservePitch: false, loudnessNormalization: true };
  await act(async () => root.update(tree()));
  for (const deck of mockDecks) {
    expect(deck.setPlaybackRate).toHaveBeenLastCalledWith(1.5, 'medium');
    expect(deck.shouldCorrectPitch).toBe(false);
    expect(deck.setCrimsonNormalization).toHaveBeenLastCalledWith(true);
  }
  await position(mockDecks[0], 102);
  await position(mockDecks[0], 115);
  expect(player.currentSong.id).toBe('b');
  expect(mockDecks[1].shouldCorrectPitch).toBe(false);
  mockPlayback = { playbackSpeed: 1, preservePitch: true, loudnessNormalization: false };
  await act(async () => root.update(tree()));
  for (const deck of mockDecks) {
    expect(deck.setPlaybackRate).toHaveBeenLastCalledWith(1, 'high');
    expect(deck.shouldCorrectPitch).toBe(true);
    expect(deck.setCrimsonNormalization).toHaveBeenLastCalledWith(false);
  }
});
