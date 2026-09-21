import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import WidgetActionScreen from '../src/app/widget';
import { createWidgetSnapshot } from '../src/services/widgets';
import { loadFavoriteSongs } from '../src/services/music';
import { subscribeToWidgetPlayerPresentation } from '../src/services/widget-navigation';

let mockParams;
let mockPlayer;
let mockAuth;
let mockPlaying;
let mockOffline;
let mockDownloads;
let mockNavigationState;
let unsubscribePresentation;
const mockReplace = jest.fn();
const mockPresentation = jest.fn();
const mockDispatch = jest.fn((action) => { mockNavigationState = action.payload; });
const mockNavigation = { getState: () => mockNavigationState, dispatch: mockDispatch };
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }), useNavigation: () => mockNavigation, useLocalSearchParams: () => mockParams }));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => mockAuth }));
jest.mock('../src/providers/player-provider', () => ({ usePlayer: () => mockPlayer, usePlayerStatus: () => ({ playing: mockPlaying }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { background: '#111111', accent: '#FF3366' } }) }));
jest.mock('../src/providers/network-provider', () => ({ useNetwork: () => ({ isOffline: mockOffline }) }));
jest.mock('../src/providers/download-provider', () => ({ useDownloads: () => mockDownloads }));
jest.mock('../src/services/music', () => ({ loadFavoriteSongs: jest.fn() }));
jest.mock('../src/services/alert', () => ({ Alert: { alert: jest.fn() } }));

beforeEach(() => {
  mockNavigationState = { index: 1, routes: [{ name: '(app)', key: 'existing-app', state: { index: 0, routes: [{ name: '(home)', key: 'home-tab', state: { index: 0, routes: [{ name: 'index', key: 'home-screen' }] } }] } }, { name: 'widget' }] };
  unsubscribePresentation = subscribeToWidgetPlayerPresentation(mockPresentation);
  mockAuth = { ready: true, user: { uid: 'listener' }, onboardingComplete: true };
  mockParams = { action: 'resume' };
  mockPlaying = false;
  mockOffline = false;
  mockDownloads = { ready: true, isDownloaded: () => false, songsForCollection: () => [] };
  mockPlayer = {
    ready: true, currentSong: { id: 'track' }, playbackState: 'restored',
    togglePlay: jest.fn(), playNext: jest.fn(), playPrevious: jest.fn(), playSong: jest.fn(),
  };
  loadFavoriteSongs.mockResolvedValue([]);
});
afterEach(() => unsubscribePresentation());

function currentCollectionRoute() {
  const tabs = mockNavigationState.routes[0].state;
  const stack = tabs.routes[tabs.index].state;
  return stack.routes[stack.index];
}

test('cold widget resume waits for player restoration and executes exactly once', async () => {
  mockPlayer.ready = false;
  let renderer;
  await act(async () => { renderer = create(<WidgetActionScreen />); });
  expect(mockPlayer.togglePlay).not.toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
  mockPlayer.ready = true;
  await act(async () => { renderer.update(<WidgetActionScreen />); });
  expect(mockPlayer.togglePlay).toHaveBeenCalledTimes(1);
  expect(mockNavigationState.routes.map((route) => route.name)).toEqual(['(app)']);
  expect(mockPresentation).toHaveBeenCalledWith(true);
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => { renderer.update(<WidgetActionScreen />); });
  expect(mockPlayer.togglePlay).toHaveBeenCalledTimes(1);
  await act(async () => renderer.unmount());
});

test('stale pause or resume widget links do not reverse the requested playback state', async () => {
  mockParams = { action: 'pause' };
  let renderer;
  await act(async () => { renderer = create(<WidgetActionScreen />); });
  expect(mockPlayer.togglePlay).not.toHaveBeenCalled();
  await act(async () => renderer.unmount());
  mockParams = { action: 'resume' };
  mockPlaying = true;
  await act(async () => { renderer = create(<WidgetActionScreen />); });
  expect(mockPlayer.togglePlay).not.toHaveBeenCalled();
  await act(async () => renderer.unmount());
});

test('next and Favorites widget actions perform playback rather than only navigating', async () => {
  mockParams = { action: 'next' };
  let renderer;
  await act(async () => { renderer = create(<WidgetActionScreen />); });
  expect(mockPlayer.playNext).toHaveBeenCalledTimes(1);
  await act(async () => renderer.unmount());
  mockParams = { action: 'favorites' };
  const songs = [{ id: 'favorite' }];
  loadFavoriteSongs.mockResolvedValue(songs);
  await act(async () => { renderer = create(<WidgetActionScreen />); });
  expect(mockPlayer.playSong).toHaveBeenCalledWith(songs[0], songs, 'Favorites', 'favorites');
  expect(currentCollectionRoute().name).toBe('favorites');
  expect(mockPresentation).toHaveBeenCalledWith(false);
  await act(async () => renderer.unmount());
});

test('mix links request autoplay on the correct mix and reject unknown mix IDs', async () => {
  mockParams = { action: 'mix', kind: 'weekly' };
  let renderer;
  await act(async () => { renderer = create(<WidgetActionScreen />); });
  expect(currentCollectionRoute()).toMatchObject({ name: 'mix', params: { id: 'weekly', play: '1', playRequest: expect.any(String) } });
  await act(async () => renderer.unmount());
  mockParams = { action: 'mix', kind: '../settings' };
  await act(async () => { renderer = create(<WidgetActionScreen />); });
  expect(currentCollectionRoute()).toMatchObject({ name: 'mix', params: { id: 'daily', play: '1', playRequest: expect.any(String) } });
  await act(async () => renderer.unmount());
});

test('signing out removes private playback metadata from widget snapshots', () => {
  const snapshot = createWidgetSnapshot({ signedIn: false, song: { title: 'Private title', creator: 'Private artist', image: 'secret-artwork', url: 'secret-stream' }, playing: true, nextSong: { title: 'Next private title' }, previousSong: {}, source: 'Private playlist' });
  expect(snapshot).toMatchObject({ signedIn: false, hasTrack: false, playing: false, artworkUrl: '', source: '', nextTitle: '', canGoNext: false, canGoPrevious: false });
  expect(JSON.stringify(snapshot)).not.toContain('Private');
  expect(JSON.stringify(snapshot)).not.toContain('secret');
});

test('offline Favorites waits for downloads and queues only available tracks', async () => {
  mockParams = { action: 'favorites' };
  mockOffline = true;
  mockDownloads.ready = false;
  mockDownloads.isDownloaded = (id) => id === 'downloaded';
  loadFavoriteSongs.mockResolvedValue([{ id: 'online-only', source: 'audius' }, { id: 'downloaded', source: 'audius' }, { id: 'local:favorite', source: 'local' }]);
  let renderer;
  await act(async () => { renderer = create(<WidgetActionScreen />); });
  expect(loadFavoriteSongs).not.toHaveBeenCalled();
  mockDownloads.ready = true;
  await act(async () => { renderer.update(<WidgetActionScreen />); });
  expect(mockPlayer.playSong).toHaveBeenCalledWith({ id: 'downloaded', source: 'audius' }, [{ id: 'downloaded', source: 'audius' }, { id: 'local:favorite', source: 'local' }], 'Favorites', 'favorites');
  await act(async () => renderer.unmount());
});

test('leaving a widget action cancels a pending Favorites playback handoff', async () => {
  mockParams = { action: 'favorites' };
  let resolve;
  loadFavoriteSongs.mockReturnValue(new Promise((finish) => { resolve = finish; }));
  let renderer;
  await act(async () => { renderer = create(<WidgetActionScreen />); });
  await act(async () => renderer.unmount());
  await act(async () => resolve([{ id: 'favorite' }]));
  expect(mockPlayer.playSong).not.toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
});

test('warm widget taps remove all legacy player screens and repeatedly use the shared player', async () => {
  mockNavigationState.routes.splice(1, 0, ...Array.from({ length: 30 }, (_, index) => ({ name: 'player', key: `old-player-${index}` })));
  const tabState = mockNavigationState.routes[0].state;
  mockPlaying = true;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    mockNavigationState.routes.push({ name: 'widget', key: `widget-${attempt}` });
    mockNavigationState.index = mockNavigationState.routes.length - 1;
    let renderer;
    await act(async () => { renderer = create(<WidgetActionScreen />); });
    expect(mockNavigationState.routes).toHaveLength(1);
    expect(mockNavigationState.routes[0]).toMatchObject({ name: '(app)', key: 'existing-app' });
    expect(mockNavigationState.routes[0].state).toBe(tabState);
    await act(async () => renderer.unmount());
  }
  expect(mockPresentation).toHaveBeenCalledTimes(15);
  expect(mockPresentation.mock.calls.every(([expanded]) => expanded)).toBe(true);
  expect(mockReplace).not.toHaveBeenCalled();
});

test('repeated warm mix taps reuse a route while issuing distinct play requests', async () => {
  mockParams = { action: 'mix', kind: 'weekly' };
  let previousRequest;
  let mixKey;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    mockNavigationState.routes.push({ name: 'widget' });
    let renderer;
    await act(async () => { renderer = create(<WidgetActionScreen />); });
    const mix = currentCollectionRoute();
    expect(mix.params.playRequest).not.toBe(previousRequest);
    previousRequest = mix.params.playRequest;
    if (mixKey) expect(mix.key).toBe(mixKey);
    mixKey = mix.key;
    expect(mockNavigationState.routes).toHaveLength(1);
    expect(mockNavigationState.routes[0].state.routes[0].state.routes.map((route) => route.name)).toEqual(['index', 'mix']);
    await act(async () => renderer.unmount());
  }
});
