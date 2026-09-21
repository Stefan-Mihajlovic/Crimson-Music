import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { AppState } from 'react-native';
import { act, create } from 'react-test-renderer';
import { PlayerProvider, usePlayer } from '../src/providers/player-provider';
import { loadRelatedSongs, resolveTrackPlaybackUrl } from '../src/services/music';
import { restorePlaybackSession } from '../src/services/playback-session';
import { activateAccount, disposeDeletedAccount } from '../src/services/account-lifecycle';

let mockDecks;
let mockDeckIndex;
let mockUser;
let mockSettings;
const mockPlaybackUri = () => null;
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-audio', () => ({
  useAudioPlayer: () => require('react').useState(() => mockDecks[mockDeckIndex++])[0],
  useAudioPlayerStatus: (deck) => require('react').useSyncExternalStore(deck.subscribe, deck.getSnapshot),
  setAudioModeAsync: jest.fn(async () => undefined),
}));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../src/providers/download-provider', () => ({ useDownloads: () => ({ getPlaybackUri: mockPlaybackUri }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => mockSettings }));
jest.mock('../src/services/remote-controls', () => ({ configureRemoteControls: jest.fn(), subscribeToRemoteControls: () => () => {} }));
jest.mock('../src/services/audius-session', () => ({ audiusMediaHeaders: jest.fn(async () => undefined) }));
jest.mock('../src/services/music', () => ({
  getUserCollectionState: jest.fn(async () => false),
  loadRelatedSongs: jest.fn(async () => []),
  normalizeRemoteImageUrl: (value) => value,
  recordListeningEvent: jest.fn(async () => undefined),
  resolveTrackPlaybackUrl: jest.fn(async (song) => `https://example.test/${song.id}.mp3`),
  toggleUserCollectionItem: jest.fn(async () => true),
}));
jest.mock('../src/services/playback-session', () => ({
  ...jest.requireActual('../src/services/playback-session'),
  restorePlaybackSession: jest.fn(async () => null),
  savePlaybackSession: jest.fn(async () => undefined),
}));

function deck(id) {
  let status = { id, isLoaded: false, playing: false, isBuffering: false, currentTime: 0, duration: 180, didJustFinish: false };
  const subscriptions = new Set();
  const events = new Set();
  const update = (patch) => {
    if (Object.entries(patch).every(([key, value]) => status[key] === value)) return;
    status = { ...status, ...patch };
    events.forEach((listener) => listener(status));
    subscriptions.forEach((listener) => listener());
  };
  return {
    id, volume: 1, loop: false, isAudioSamplingSupported: false,
    get playing() { return status.playing; },
    get isLoaded() { return status.isLoaded; },
    get isBuffering() { return status.isBuffering; },
    get currentTime() { return status.currentTime; },
    get duration() { return status.duration; },
    getSnapshot: () => status,
    subscribe: (listener) => { subscriptions.add(listener); return () => subscriptions.delete(listener); },
    update,
    play: jest.fn(() => update({ playing: true })),
    pause: jest.fn(() => update({ playing: false })),
    replace: jest.fn((source) => update({ isLoaded: !!source, playing: false, currentTime: 0, didJustFinish: false })),
    seekTo: jest.fn(async (currentTime) => update({ currentTime })),
    setActiveForLockScreen: jest.fn(), clearLockScreenControls: jest.fn(), setAudioSamplingEnabled: jest.fn(), setPlaybackRate: jest.fn(), setCrimsonNormalization: jest.fn(),
    // Real platform adapter operates these persistent raw decks, never the proxy.
    setCrimsonSleepTimer: jest.fn(), crimsonSleepTimerExpiredAt: 0,
    addListener: jest.fn((event, listener) => {
      if (event === 'playbackStatusUpdate') events.add(listener);
      return { remove: () => events.delete(listener) };
    }),
  };
}

let player;
let root;
const appListeners = new Set();
function Probe() {
  const value = usePlayer();
  React.useEffect(() => { player = value; }, [value]);
  return null;
}
const tree = () => <PlayerProvider><Probe /></PlayerProvider>;
const song = (id) => ({ id, title: id, creator: 'Artist', duration: 180, streamable: true, image: '', imageSmall: '', source: 'audius' });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const mount = async () => { await act(async () => { root = create(tree()); }); };
const start = async (songs = [song('a'), song('b'), song('c')]) => {
  await mount();
  await act(async () => player.playSong(songs[0], songs, 'Test queue'));
};
const progress = async (index, currentTime, didJustFinish = false) => {
  await act(async () => mockDecks[index].update({ currentTime, didJustFinish, ...(didJustFinish ? { playing: false } : {}) }));
};
const clearPlayCalls = () => mockDecks.forEach((item) => item.play.mockClear());
const appChange = async (state) => {
  AppState.currentState = state;
  await act(async () => appListeners.forEach((listener) => listener(state)));
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-13T12:00:00Z'));
  mockDeckIndex = 0;
  mockDecks = [deck(1), deck(2)];
  mockUser = { uid: 'sleep-listener' };
  activateAccount(mockUser.uid);
  mockSettings = { reduceMotion: true, performanceMode: false, crossfadeEnabled: true, crossfadeSeconds: 8 };
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appListeners.add(listener);
    return { remove: () => appListeners.delete(listener) };
  });
  restorePlaybackSession.mockResolvedValue(null);
  loadRelatedSongs.mockResolvedValue([]);
  resolveTrackPlaybackUrl.mockImplementation(async (track) => `https://example.test/${track.id}.mp3`);
  root = undefined;
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  jest.restoreAllMocks();
  appListeners.clear();
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('wall-clock expiration pauses both overlapping decks without advancing the queue', async () => {
  await start();
  await act(async () => player.startSleepTimer(5));
  const deadline = player.sleepTimer.getSnapshot().deadlineAt;
  mockDecks.forEach((item) => expect(item.setCrimsonSleepTimer).toHaveBeenLastCalledWith(deadline));
  await progress(0, 160);
  await progress(0, 175);
  expect(player.currentSong.id).toBe('b');
  expect(mockDecks.map((item) => item.playing)).toEqual([true, true]);
  const audibleWhenDisarmed = [];
  mockDecks.forEach((item) => item.setCrimsonSleepTimer.mockImplementation((nextDeadline) => {
    if (nextDeadline === 0) audibleWhenDisarmed.push(mockDecks.some((deck) => deck.playing));
  }));
  clearPlayCalls();
  await act(async () => jest.advanceTimersByTime(5 * 60_000));
  expect(mockDecks.map((item) => item.playing)).toEqual([false, false]);
  expect(player.sleepTimer.getSnapshot().mode).toBe('off');
  expect(player.currentSong.id).toBe('b');
  expect(player.queueIndex).toBe(1);
  expect(audibleWhenDisarmed).not.toContain(true);
  mockDecks.forEach((item) => expect(item.play).not.toHaveBeenCalled());
});

test.each(['queue', 'repeat all', 'repeat one', 'autoplay'])('end-of-song consumes the finish before %s or crossfade', async (mode) => {
  loadRelatedSongs.mockResolvedValue([song('related')]);
  await start(mode === 'autoplay' ? [song('a')] : [song('a'), song('b')]);
  if (mode === 'repeat all' || mode === 'repeat one') await act(async () => player.toggleRepeat());
  if (mode === 'repeat one') await act(async () => player.toggleRepeat());
  await act(async () => player.startSleepTimer('end-of-track'));
  clearPlayCalls();
  await progress(0, 160);
  await progress(0, 175);
  expect(player.currentSong.id).toBe('a');
  await progress(0, 180, true);
  expect(player.sleepTimer.getSnapshot().mode).toBe('off');
  expect(player.currentSong.id).toBe('a');
  expect(player.queueIndex).toBe(0);
  mockDecks.forEach((item) => expect(item.play).not.toHaveBeenCalled());
});

test('end-of-song survives pausing and resuming the same loaded song', async () => {
  await start();
  await act(async () => player.startSleepTimer('end-of-track'));
  await act(async () => player.togglePlay());
  expect(mockDecks[0].playing).toBe(false);
  await act(async () => player.togglePlay());
  expect(mockDecks[0].playing).toBe(true);
  expect(player.sleepTimer.getSnapshot().mode).toBe('end-of-track');
  await progress(0, 180, true);
  expect(player.currentSong.id).toBe('a');
  expect(player.sleepTimer.getSnapshot().mode).toBe('off');
});

test('end-of-song follows a restored song through its first resumed activation', async () => {
  restorePlaybackSession.mockResolvedValue({ queue: [song('saved'), song('next')], index: 0, position: 42, source: 'Favorites', sourceId: '', repeat: 'none', shuffled: false });
  await mount();
  expect(player.playbackState).toBe('restored');
  await act(async () => player.startSleepTimer('end-of-track'));
  await act(async () => player.togglePlay());
  expect(mockDecks[0].currentTime).toBe(42);
  expect(mockDecks[0].playing).toBe(true);
  expect(player.sleepTimer.getSnapshot().mode).toBe('end-of-track');
  await progress(0, 180, true);
  expect(player.currentSong.id).toBe('saved');
  expect(player.sleepTimer.getSnapshot().mode).toBe('off');
});

test('pausing an unresolved source and retrying retains its end-of-song timer', async () => {
  const pending = deferred();
  resolveTrackPlaybackUrl.mockReturnValueOnce(pending.promise);
  await start();
  await act(async () => player.startSleepTimer('end-of-track'));
  await act(async () => player.togglePlay());
  await act(async () => player.togglePlay());
  await act(async () => pending.resolve('https://example.test/stale.mp3'));
  expect(mockDecks[0].playing).toBe(true);
  expect(player.sleepTimer.getSnapshot().mode).toBe('end-of-track');
  await progress(0, 180, true);
  expect(player.currentSong.id).toBe('a');
  expect(player.sleepTimer.getSnapshot().mode).toBe('off');
});

test.each(['end-of-track', 5])('manual skip handles %s without changing the timed deadline', async (setting) => {
  await start();
  await act(async () => player.startSleepTimer(setting));
  const deadline = player.sleepTimer.getSnapshot().deadlineAt;
  await act(async () => player.playNext());
  expect(player.currentSong.id).toBe('b');
  expect(player.sleepTimer.getSnapshot().mode).toBe(setting === 5 ? 'duration' : 'off');
  expect(player.sleepTimer.getSnapshot().deadlineAt).toBe(deadline);
});

test('a source resolving after the wall-clock deadline cannot start before the overdue JS callback', async () => {
  const pending = deferred();
  resolveTrackPlaybackUrl.mockReturnValueOnce(pending.promise);
  await start();
  await act(async () => player.startSleepTimer(5));
  jest.setSystemTime(player.sleepTimer.getSnapshot().deadlineAt + 1);
  await act(async () => pending.resolve('https://example.test/late.mp3'));
  expect(player.sleepTimer.getSnapshot().mode).toBe('off');
  mockDecks.forEach((item) => expect(item.play).not.toHaveBeenCalled());
  expect(player.currentSong.id).toBe('a');
  // A later explicit user play is still allowed.
  await act(async () => player.togglePlay());
  expect(mockDecks[0].playing).toBe(true);
});

test('late autoplay is discarded at the deadline even before timer callbacks resume', async () => {
  const pending = deferred();
  loadRelatedSongs.mockReturnValue(pending.promise);
  await start([song('a')]);
  await act(async () => player.startSleepTimer(5));
  await progress(0, 180, true);
  clearPlayCalls();
  jest.setSystemTime(player.sleepTimer.getSnapshot().deadlineAt + 1);
  await act(async () => pending.resolve([song('related')]));
  expect(player.sleepTimer.getSnapshot().mode).toBe('off');
  expect(player.currentSong.id).toBe('a');
  expect(player.queue.map((track) => track.id)).toEqual(['a']);
  mockDecks.forEach((item) => expect(item.play).not.toHaveBeenCalled());
});

test('foreground reconciles native expiry even when the wall clock moved backwards while JS was suspended', async () => {
  await start();
  await act(async () => player.startSleepTimer(5));
  const deadline = player.sleepTimer.getSnapshot().deadlineAt;
  await appChange('background');
  mockDecks[1].crimsonSleepTimerExpiredAt = deadline;
  await appChange('active');
  expect(player.sleepTimer.getSnapshot().mode).toBe('off');
  expect(mockDecks.map((item) => item.playing)).toEqual([false, false]);
  expect(player.currentSong.id).toBe('a');
});

test.each([null, { uid: 'another-listener' }])('account departure cancels native and JS deadlines', async (nextUser) => {
  await start();
  await act(async () => player.startSleepTimer(5));
  mockUser = nextUser;
  await act(async () => root.update(tree()));
  expect(player.sleepTimer.getSnapshot().mode).toBe('off');
  expect(player.currentSong).toBeNull();
  mockDecks.forEach((item) => expect(item.setCrimsonSleepTimer).toHaveBeenLastCalledWith(0));
  clearPlayCalls();
  await act(async () => jest.advanceTimersByTime(5 * 60_000));
  mockDecks.forEach((item) => expect(item.play).not.toHaveBeenCalled());
});

test('account-data cleanup cancels the timer and an unresolved source before sign-out', async () => {
  const pending = deferred();
  resolveTrackPlaybackUrl.mockReturnValueOnce(pending.promise);
  await start();
  await act(async () => player.startSleepTimer(5));
  await act(async () => disposeDeletedAccount(mockUser.uid));
  expect(player.sleepTimer.getSnapshot().mode).toBe('off');
  expect(player.currentSong).toBeNull();
  expect(player.queue).toEqual([]);
  mockDecks.forEach((item) => expect(item.setCrimsonSleepTimer).toHaveBeenLastCalledWith(0));
  await act(async () => pending.resolve('https://example.test/deleted.mp3'));
  mockDecks.forEach((item) => expect(item.play).not.toHaveBeenCalled());
});
