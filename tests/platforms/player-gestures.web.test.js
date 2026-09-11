import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import WebPlayerBar from '../../src/components/web-player-bar';
import MobilePlayerSurface from '../../src/components/mobile-player-surface.web';
import { SwipeableArtwork } from '../../src/components/song-swipe-pager.web';
import { beginWebPlayerMotion, cancelWebPlayerMotion, getWebPlayerMotion, getWebPlayerMotionSession, settleWebPlayerMotion } from '../../src/services/web-player-motion';

const mockSong = { id: 'one', title: 'First song', creator: 'Artist', image: '', imageSmall: '' };
const mockPlayer = {
  currentSong: mockSong, nextSong: { ...mockSong, id: 'two', title: 'Next song' }, previousSong: { ...mockSong, id: 'zero', title: 'Previous song' },
  togglePlay: jest.fn(), playNext: jest.fn(), playPrevious: jest.fn(), seekTo: jest.fn(),
  toggleShuffle: jest.fn(), toggleRepeat: jest.fn(), toggleLike: jest.fn(), setVolume: jest.fn(),
  repeatMode: 'none', volume: 1,
};
const mockRouter = { push: jest.fn(), back: jest.fn(), dismiss: jest.fn(), replace: jest.fn(), canGoBack: () => true };
const mockSettings = { colors: { text: '#fff', secondaryText: '#aaa', accent: '#95f', border: '#333', elevated: '#21192b' }, isDark: true, reduceMotion: false };
let mockFocused = true;
jest.mock('../../src/providers/player-provider', () => ({ usePlayer: () => mockPlayer, usePlayerStatus: () => ({ playing: false, currentTime: 12, duration: 180 }) }));
jest.mock('../../src/providers/settings-provider', () => ({ useAppSettings: () => mockSettings }));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useIsFocused: () => mockFocused }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('../../src/components/mini-player', () => jest.requireActual('../../src/components/mini-player.web'));
jest.mock('../../src/components/song-swipe-pager', () => jest.requireActual('../../src/components/song-swipe-pager.web'));
jest.mock('../../src/components/player-artwork-background', () => () => null);
jest.mock('../../src/services/action-sheet', () => ({ useDetailRoutes: () => ({ artistHref: (id) => `/artist/${id}` }), releaseWebNavigationFocus: jest.fn() }));
jest.mock('../../src/app/player', () => ({
  getPlayerArtworkLayout: () => ({ x: 22, y: 97, size: 356 }),
  PlayerContent: ({ onClose }) => <div>
    <div data-testid="player-drag-header"><span data-testid="header-handle">Playing from</span><button aria-label="Minimize player" onClick={onClose}>Close</button></div>
    <div data-testid="player-drag-artwork"><div data-testid="cover-handle">Artwork</div></div>
    <div data-testid="player-scroll-content"><input aria-label="Playback position" type="range" /><p>Scrollable content</p></div>
  </div>,
}));

let root;
let container;
let clock;
const pointer = (target, type, x, y) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true }, timeStamp: { value: clock += 30 } });
  target.dispatchEvent(event);
};
beforeEach(() => {
  jest.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 400 });
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
  window.dispatchEvent(new Event('resize'));
  clock = 0;
  cancelWebPlayerMotion(getWebPlayerMotionSession());
  mockFocused = true;
  mockRouter.push.mockReset();
  mockSettings.reduceMotion = false;
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); cancelWebPlayerMotion(getWebPlayerMotionSession()); jest.useRealTimers(); });

test('a mobile mini-player drag follows the pointer through the expanded-route handoff', () => {
  const render = (expanded) => <><WebPlayerBar mobileBottom={80} hidden={expanded} />{expanded ? <MobilePlayerSurface /> : null}</>;
  mockRouter.push.mockImplementation(() => root.render(render(true)));
  act(() => root.render(render(false)));
  act(() => pointer(container.querySelector('.crimson-mini-track'), 'pointerdown', 100, 700));
  act(() => pointer(window, 'pointermove', 100, 640));
  expect(mockRouter.push).toHaveBeenCalledWith('/player');
  expect(getWebPlayerMotion().position).toBe(608);
  expect(container.querySelector('[data-testid="mobile-player-surface"]').style.transform).toContain('translateY(608px)');
  // The mini has unmounted; its globally owned pointer stream remains active.
  act(() => pointer(window, 'pointermove', 100, 450));
  expect(getWebPlayerMotion().position).toBe(418);
  act(() => pointer(window, 'pointerup', 100, 450));
  expect(getWebPlayerMotion().position).toBe(0);
  act(() => jest.advanceTimersByTime(280));
  expect(getWebPlayerMotion().phase).toBe('rest');
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test('expanded player cover drags down visibly and dismisses after settling', () => {
  act(() => root.render(<MobilePlayerSurface />));
  act(() => pointer(container.querySelector('[data-testid="cover-handle"]'), 'pointerdown', 100, 200));
  act(() => pointer(window, 'pointermove', 100, 390));
  expect(container.querySelector('[data-testid="mobile-player-surface"]').style.transform).toContain('translateY(190px)');
  act(() => pointer(window, 'pointerup', 100, 390));
  expect(mockRouter.back).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(280));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test('leaving the player during collapse cancels its delayed navigation', () => {
  act(() => root.render(<MobilePlayerSurface />));
  act(() => pointer(container.querySelector('[data-testid="cover-handle"]'), 'pointerdown', 100, 200));
  act(() => pointer(window, 'pointermove', 100, 390));
  act(() => pointer(window, 'pointerup', 100, 390));
  expect(getWebPlayerMotion().phase).toBe('settling');
  // Browser Back has already removed the route; the animation must not pop again.
  act(() => root.render(null));
  act(() => jest.advanceTimersByTime(500));
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(getWebPlayerMotion().phase).toBe('rest');
});

test.each([0, 20, 40])('route teardown cancels close frames and completion after %i ms', (elapsed) => {
  act(() => root.render(<MobilePlayerSurface />));
  act(() => container.querySelector('[aria-label="Minimize player"]').click());
  act(() => jest.advanceTimersByTime(elapsed));
  act(() => root.render(null));
  act(() => jest.advanceTimersByTime(500));
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(getWebPlayerMotion().phase).toBe('rest');
});

test('a retained player route cancels collapse when it loses focus', () => {
  act(() => root.render(<MobilePlayerSurface />));
  act(() => container.querySelector('[aria-label="Minimize player"]').click());
  act(() => jest.advanceTimersByTime(40));
  expect(getWebPlayerMotion().phase).toBe('settling');
  mockFocused = false;
  act(() => root.render(<MobilePlayerSurface />));
  act(() => jest.advanceTimersByTime(500));
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(getWebPlayerMotion().phase).toBe('rest');
});

test('old player cleanup cannot cancel a newer motion session', () => {
  act(() => root.render(<MobilePlayerSurface />));
  act(() => container.querySelector('[aria-label="Minimize player"]').click());
  act(() => jest.advanceTimersByTime(40));
  const finishedNewOpening = jest.fn();
  act(() => {
    const newSession = beginWebPlayerMotion(600, 668);
    settleWebPlayerMotion(newSession, true, false, finishedNewOpening);
  });
  act(() => root.render(null));
  expect(getWebPlayerMotion().phase).toBe('settling');
  act(() => jest.advanceTimersByTime(280));
  expect(finishedNewOpening).toHaveBeenCalledTimes(1);
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test('returning to the mini player during its gesture prevents stale release navigation', () => {
  const render = (expanded) => <><WebPlayerBar mobileBottom={80} hidden={expanded} />{expanded ? <MobilePlayerSurface /> : null}</>;
  mockRouter.push.mockImplementation(() => root.render(render(true)));
  act(() => root.render(render(false)));
  act(() => pointer(container.querySelector('.crimson-mini-track'), 'pointerdown', 100, 700));
  act(() => pointer(window, 'pointermove', 100, 640));
  act(() => root.render(render(false)));
  act(() => pointer(window, 'pointercancel', 100, 640));
  act(() => jest.advanceTimersByTime(500));
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(getWebPlayerMotion().phase).toBe('rest');
});

test('sliders, transport buttons, and scrolling content never start player dismissal', () => {
  act(() => root.render(<MobilePlayerSurface />));
  for (const selector of ['input', 'button', '[data-testid="player-scroll-content"]']) {
    act(() => pointer(container.querySelector(selector), 'pointerdown', 100, 200));
    act(() => pointer(window, 'pointermove', 100, 500));
    act(() => pointer(window, 'pointerup', 100, 500));
    expect(getWebPlayerMotion().phase).toBe('rest');
  }
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test('a cancelled pointer drag restores the full player without navigating', () => {
  act(() => root.render(<MobilePlayerSurface />));
  act(() => pointer(container.querySelector('[data-testid="header-handle"]'), 'pointerdown', 100, 40));
  act(() => pointer(window, 'pointermove', 100, 170));
  act(() => pointer(window, 'pointercancel', 100, 170));
  expect(getWebPlayerMotion().position).toBe(0);
  act(() => jest.advanceTimersByTime(280));
  expect(mockRouter.back).not.toHaveBeenCalled();
});

test('horizontal cover swipes change songs without a vertical player drag', () => {
  act(() => root.render(<SwipeableArtwork size={200} />));
  act(() => pointer(container.querySelector('[data-testid="web-artwork-swipe"]'), 'pointerdown', 220, 200));
  act(() => pointer(window, 'pointermove', 70, 203));
  act(() => pointer(window, 'pointerup', 70, 203));
  act(() => jest.advanceTimersByTime(180));
  expect(mockPlayer.playNext).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).not.toHaveBeenCalled();
});
