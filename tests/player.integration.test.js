import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { AppState } from 'react-native';
import { act, create } from 'react-test-renderer';
import { setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PlayerProvider, usePlayer, usePlayerSpectrum } from '../src/providers/player-provider';
import { getUserCollectionState, loadRelatedSongs, recordListeningEvent, resolveTrackPlaybackUrl, toggleUserCollectionItem } from '../src/services/music';

const mockAudio = {
  id: 1, isLoaded: true, playing: false, currentTime: 0, duration: 180,
  isAudioSamplingSupported: true,
  pause: jest.fn(), play: jest.fn(), replace: jest.fn(), seekTo: jest.fn(),
  setActiveForLockScreen: jest.fn(), setAudioSamplingEnabled: jest.fn(),
  clearLockScreenControls: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};
let mockStatus;
let mockUser;
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => mockAudio,
  useAudioPlayerStatus: () => mockStatus,
  setAudioModeAsync: jest.fn(async () => undefined),
}));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../src/providers/download-provider', () => ({ useDownloads: () => ({ getPlaybackUri: () => null }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ reduceMotion: false, performanceMode: false }) }));
jest.mock('../src/services/remote-controls', () => ({ configureRemoteControls: jest.fn(), subscribeToRemoteControls: () => () => {} }));
jest.mock('../src/services/audius-session', () => ({ audiusMediaHeaders: jest.fn(async () => undefined) }));
jest.mock('../src/services/music', () => ({
  getUserCollectionState: jest.fn(async () => false),
  loadRelatedSongs: jest.fn(async () => []),
  normalizeRemoteImageUrl: (value) => value,
  recordListeningEvent: jest.fn(async () => undefined),
  resolveTrackPlaybackUrl: jest.fn(async () => 'https://example.test/audio.mp3'),
  toggleUserCollectionItem: jest.fn(async () => true),
}));

let player;
let spectrum;
let root;
let appStateSubscription;
const appStateListeners = new Set();
function Probe() {
  const value = usePlayer();
  const levels = usePlayerSpectrum();
  React.useEffect(() => { player = value; spectrum = levels; }, [value, levels]);
  return null;
}
const tree = () => React.createElement(PlayerProvider, null, React.createElement(Probe));
const song = (id) => ({ id, title: id, creator: 'Artist', duration: 180, image: '', imageSmall: '', source: 'audius' });
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  AppState.currentState = 'active';
  appStateSubscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((event, listener) => {
    if (event === 'change') appStateListeners.add(listener);
    return { remove: () => { appStateListeners.delete(listener); } };
  });
  mockUser = { uid: 'listener' };
  mockStatus = { id: 1, isLoaded: true, playing: false, isBuffering: false, currentTime: 0, duration: 180, didJustFinish: false };
  getUserCollectionState.mockResolvedValue(false);
  resolveTrackPlaybackUrl.mockResolvedValue('https://example.test/audio.mp3');
  await act(async () => { root = create(tree()); });
});

afterEach(async () => {
  await act(async () => root.unmount());
  appStateSubscription.mockRestore();
  appStateListeners.clear();
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function start(id) {
  await act(async () => player.playSong(song(id)));
  await act(async () => jest.advanceTimersByTime(100));
}

test('late autoplay cannot replace a song the listener selected in the meantime', async () => {
  const related = deferred();
  loadRelatedSongs.mockReturnValueOnce(related.promise);
  await start('a');
  await act(async () => player.playNext());
  await start('b');
  await act(async () => related.resolve([song('c')]));
  expect(player.currentSong.id).toBe('b');
  expect(player.queue.map((track) => track.id)).toEqual(['b']);
});

test('failed streams do not create play or skip listening events', async () => {
  resolveTrackPlaybackUrl.mockRejectedValueOnce(new Error('stream unavailable'));
  await start('failed');
  await start('next');
  expect(recordListeningEvent).not.toHaveBeenCalled();
});

test('Play retries a failed source instead of resuming the previous native track', async () => {
  await start('previous');
  mockAudio.play.mockClear();
  mockAudio.replace.mockClear();
  resolveTrackPlaybackUrl.mockClear();
  resolveTrackPlaybackUrl.mockRejectedValueOnce(new Error('offline'));
  await start('retry');
  expect(player.playbackState).toBe('error');
  expect(player.playbackError).toBeTruthy();
  expect(mockAudio.pause).toHaveBeenCalled();
  expect(mockAudio.play).not.toHaveBeenCalled();
  const retry = deferred();
  resolveTrackPlaybackUrl.mockReturnValueOnce(retry.promise);
  await act(async () => player.togglePlay());
  expect(mockAudio.play).not.toHaveBeenCalled();
  expect(mockAudio.replace).not.toHaveBeenCalled();
  await act(async () => retry.resolve('https://example.test/retry.mp3'));
  await act(async () => jest.advanceTimersByTime(100));
  expect(player.playbackError).toBeNull();
  expect(resolveTrackPlaybackUrl).toHaveBeenCalledTimes(2);
  expect(player.currentSong.id).toBe('retry');
  expect(mockAudio.replace).toHaveBeenCalledWith(expect.objectContaining({ uri: 'https://example.test/retry.mp3', name: 'retry' }));
  expect(mockAudio.play).toHaveBeenCalledTimes(1);
});

test('play is emitted once only after loaded audio is actually playing', async () => {
  await start('a');
  expect(recordListeningEvent).not.toHaveBeenCalled();
  mockStatus = { ...mockStatus, playing: true, currentTime: 1 };
  await act(async () => root.update(tree()));
  mockStatus = { ...mockStatus, currentTime: 2 };
  await act(async () => root.update(tree()));
  expect(recordListeningEvent.mock.calls.filter((call) => call[1] === 'play')).toHaveLength(1);
});

test('stale like reads and mutations cannot change the next song heart', async () => {
  const oldLike = deferred();
  getUserCollectionState.mockReturnValueOnce(oldLike.promise);
  await start('a');
  await start('b');
  await act(async () => oldLike.resolve(true));
  expect(player.isLiked).toBe(false);
  const toggle = deferred();
  toggleUserCollectionItem.mockReturnValueOnce(toggle.promise);
  let pending;
  await act(async () => { pending = player.toggleLike(); });
  await start('c');
  await act(async () => { toggle.resolve(true); await pending; });
  expect(player.currentSong.id).toBe('c');
  expect(player.isLiked).toBe(false);
});

test('repeat one records completion and keeps the same track', async () => {
  loadRelatedSongs.mockResolvedValueOnce([{ ...song('related'), streamable: true }]);
  await start('a');
  await act(async () => { player.toggleRepeat(); player.toggleRepeat(); });
  mockStatus = { ...mockStatus, playing: true, currentTime: 1 };
  await act(async () => root.update(tree()));
  mockStatus = { ...mockStatus, playing: false, currentTime: 180, didJustFinish: true };
  await act(async () => root.update(tree()));
  expect(recordListeningEvent.mock.calls.filter((call) => call[1] === 'complete')).toHaveLength(1);
  expect(player.currentSong.id).toBe('a');
  expect(player.queue.map((track) => track.id)).toEqual(['a']);
  expect(resolveTrackPlaybackUrl).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a' }));
});

test('sign out clears the queue and invalidates a pending stream', async () => {
  const stream = deferred();
  resolveTrackPlaybackUrl.mockReturnValueOnce(stream.promise);
  await act(async () => player.playSong(song('old-account')));
  mockUser = null;
  await act(async () => root.update(tree()));
  expect(player.currentSong).toBeNull();
  expect(player.queue).toEqual([]);
  mockAudio.replace.mockClear();
  await act(async () => stream.resolve('https://example.test/old.mp3'));
  expect(mockAudio.replace).not.toHaveBeenCalled();
  expect(mockAudio.clearLockScreenControls).toHaveBeenCalled();
  expect(recordListeningEvent).not.toHaveBeenCalled();
});

test('changing account cancels pending autoplay and does not attribute old playback to the new user', async () => {
  await start('old-account');
  const related = deferred();
  loadRelatedSongs.mockReturnValueOnce(related.promise);
  await act(async () => player.playNext());
  mockUser = { uid: 'another-listener' };
  mockStatus = { ...mockStatus, playing: true, currentTime: 4 };
  await act(async () => root.update(tree()));
  await act(async () => related.resolve([song('autoplay')]));
  expect(player.currentSong).toBeNull();
  expect(player.queue).toEqual([]);
  expect(recordListeningEvent).not.toHaveBeenCalled();
});

test.each([
  ['a partial app-switcher swipe', ['inactive', 'active']],
  ['background playback and return', ['inactive', 'background', 'active']],
])('%s preserves the audio session, player and sampling tap', async (_label, transitions) => {
  await start('uninterrupted');
  mockStatus = { ...mockStatus, playing: true, currentTime: 4 };
  await act(async () => root.update(tree()));
  const removeSampleListener = mockAudio.addListener.mock.results[0].value.remove;
  for (const method of ['pause', 'play', 'replace', 'seekTo', 'setActiveForLockScreen', 'setAudioSamplingEnabled', 'clearLockScreenControls']) mockAudio[method].mockClear();
  setAudioModeAsync.mockClear();

  for (const state of transitions) {
    await act(async () => appStateListeners.forEach((listener) => listener(state)));
  }

  expect(player.currentSong.id).toBe('uninterrupted');
  expect(setAudioModeAsync).not.toHaveBeenCalled();
  expect(removeSampleListener).not.toHaveBeenCalled();
  for (const method of ['pause', 'play', 'replace', 'seekTo', 'setActiveForLockScreen', 'setAudioSamplingEnabled', 'clearLockScreenControls']) expect(mockAudio[method]).not.toHaveBeenCalled();
});

test('sampling stays installed across buffering and pause while visual updates follow focus', async () => {
  await start('visualizer');
  mockStatus = { ...mockStatus, playing: true, currentTime: 4 };
  await act(async () => root.update(tree()));
  const onSample = mockAudio.addListener.mock.calls.find(([event]) => event === 'audioSampleUpdate')[1];
  const sample = { channels: [{ frames: Array(16).fill(0.5) }], timestamp: 4 };
  await act(async () => onSample(sample));
  expect(spectrum).not.toEqual([0.36, 0.36, 0.36, 0.36]);
  mockAudio.setAudioSamplingEnabled.mockClear();

  await act(async () => appStateListeners.forEach((listener) => listener('inactive')));
  await act(async () => { jest.advanceTimersByTime(100); onSample(sample); });
  expect(spectrum).toEqual([0.36, 0.36, 0.36, 0.36]);
  await act(async () => appStateListeners.forEach((listener) => listener('active')));
  await act(async () => { jest.advanceTimersByTime(100); onSample(sample); });
  expect(spectrum).not.toEqual([0.36, 0.36, 0.36, 0.36]);

  for (const next of [{ playing: false, isBuffering: true }, { playing: true, isBuffering: false }, { playing: false, isBuffering: false }]) {
    mockStatus = { ...mockStatus, ...next };
    await act(async () => root.update(tree()));
  }
  expect(spectrum).toEqual([0.36, 0.36, 0.36, 0.36]);
  expect(mockAudio.setAudioSamplingEnabled).not.toHaveBeenCalled();
});
