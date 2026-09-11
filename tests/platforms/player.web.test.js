import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import WebPlayerBar from '../../src/components/web-player-bar';
import DesktopPlayerPanel from '../../src/components/desktop-player-panel';

const mockPlayer = {
  currentSong: { id: 'one', title: 'First song', creator: 'Artist', image: '' },
  togglePlay: jest.fn(), playNext: jest.fn(), playPrevious: jest.fn(), seekTo: jest.fn(),
  toggleShuffle: jest.fn(), toggleRepeat: jest.fn(), toggleLike: jest.fn(), setVolume: jest.fn(),
  repeatMode: 'none', volume: 1,
  playQueueIndex: jest.fn(), removeFromQueue: jest.fn(), moveQueueItem: jest.fn(), playSong: jest.fn(),
  toggleAutoplay: jest.fn(), queueIndex: 0, source: 'Favorites', autoplayEnabled: true,
  queue: [
    { id: 'one', title: 'First song', creator: 'Artist', image: '', duration: 180 },
    { id: 'two', title: 'Second song', creator: 'Artist', image: '', duration: 210 },
    { id: 'three', title: 'Third song', creator: 'Artist', image: '', duration: 190 },
  ],
};
const mockPush = jest.fn();
const mockLoadRelated = jest.fn();
let mockStatus = { playing: false, currentTime: 12, duration: 180 };
jest.mock('../../src/providers/player-provider', () => ({ usePlayer: () => mockPlayer, usePlayerStatus: () => mockStatus }));
jest.mock('../../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { text: '#fff', elevated: '#111', accent: '#95f', border: '#333' } }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../src/services/music', () => ({ loadRelatedSongs: (...args) => mockLoadRelated(...args) }));
jest.mock('../../src/services/action-sheet', () => ({ actionSheetHref: (params) => ({ pathname: '/action-sheet', params }), releaseWebNavigationFocus: jest.fn() }));
jest.mock('expo-image', () => ({ Image: () => null }));
// Media-session tests exercise the desktop bar, independently of mobile gestures.
jest.mock('../../src/components/mini-player', () => () => null);
let root;
let container;
let handlers;
let media;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1440 });
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 900 });
  window.dispatchEvent(new Event('resize'));
  handlers = {};
  media = { setActionHandler: jest.fn((name, handler) => { handlers[name] = handler; }), setPositionState: jest.fn() };
  Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: media });
  globalThis.MediaMetadata = class { constructor(data) { Object.assign(this, data); } };
  mockStatus = { playing: false, currentTime: 12, duration: 180 };
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<WebPlayerBar />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); delete navigator.mediaSession; delete globalThis.MediaMetadata; });

test('media commands act on the latest playback status and clear on unmount', () => {
  act(() => handlers.play());
  expect(mockPlayer.togglePlay).toHaveBeenCalledTimes(1);
  mockStatus = { playing: true, currentTime: 80, duration: 180 };
  act(() => root.render(<WebPlayerBar />));
  act(() => { handlers.play(); handlers.seekbackward({ seekOffset: 15 }); handlers.nexttrack(); });
  expect(mockPlayer.togglePlay).toHaveBeenCalledTimes(1);
  expect(mockPlayer.seekTo).toHaveBeenLastCalledWith(65);
  expect(mockPlayer.playNext).toHaveBeenCalledTimes(1);
  expect(media.playbackState).toBe('playing');
  act(() => root.render(null));
  expect(handlers.nexttrack).toBeNull();
});

test('keyboard playback shortcuts do not steal input or button keystrokes', () => {
  const key = (target, code, extra = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...extra }));
  act(() => key(document.body, 'Space'));
  expect(mockPlayer.togglePlay).toHaveBeenCalledTimes(1);
  const input = document.createElement('input'); document.body.append(input);
  act(() => key(input, 'Space'));
  const playButton = container.querySelector('[aria-label="Play"]');
  act(() => key(playButton, 'Space'));
  expect(mockPlayer.togglePlay).toHaveBeenCalledTimes(1);
  act(() => key(document.body, 'ArrowRight', { shiftKey: true }));
  expect(mockPlayer.playNext).toHaveBeenCalledTimes(1);
  input.remove();
});

test('hiding the bar for the expanded player preserves media session commands', () => {
  act(() => root.render(<WebPlayerBar hidden />));
  expect(container.querySelector('[aria-label="Play"]')).toBeNull();
  act(() => handlers.play());
  expect(mockPlayer.togglePlay).toHaveBeenCalledTimes(1);
  expect(media.metadata.title).toBe('First song');
});

test('the floating bar opens the queue inside the expanded player', () => {
  act(() => container.querySelector('[aria-label="Open Up Next"]').click());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/player', params: { tab: 'queue' } });
});

test('the integrated queue plays, reorders, and removes the correct queue index', () => {
  act(() => root.render(<DesktopPlayerPanel />));
  act(() => container.querySelector('[aria-label="Play Second song by Artist"]').click());
  expect(mockPlayer.playQueueIndex).toHaveBeenCalledWith(1);
  act(() => container.querySelector('[aria-label="Edit upcoming queue"]').click());
  act(() => container.querySelector('[aria-label="Move Third song up"]').click());
  expect(mockPlayer.moveQueueItem).toHaveBeenCalledWith(2, 1);
  act(() => container.querySelector('[aria-label="Remove Second song from queue"]').click());
  expect(mockPlayer.removeFromQueue).toHaveBeenCalledWith(1);
});

test('queue song menus preserve the expanded-player dismissal context', () => {
  act(() => root.render(<DesktopPlayerPanel />));
  act(() => container.querySelector('[aria-label="More options for Second song"]').click());
  expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/action-sheet', params: expect.objectContaining({ id: 'two', playerPresentation: 'modal' }) }));
});

test('related stays inside the player and starts the selected related queue', async () => {
  const related = [{ id: 'related', title: 'Related song', creator: 'Another artist', image: '', duration: 140, reason: 'Similar vibe' }];
  mockLoadRelated.mockResolvedValue(related);
  act(() => root.render(<DesktopPlayerPanel />));
  await act(async () => container.querySelector('#player-tab-related').click());
  expect(mockLoadRelated).toHaveBeenCalledWith('one');
  expect(container.querySelector('#player-tab-related').getAttribute('aria-selected')).toBe('true');
  act(() => container.querySelector('[aria-label="Play Related song by Another artist"]').click());
  expect(mockPlayer.playSong).toHaveBeenCalledWith(related[0], related, 'Related');
  expect(mockPush).not.toHaveBeenCalled();
});
