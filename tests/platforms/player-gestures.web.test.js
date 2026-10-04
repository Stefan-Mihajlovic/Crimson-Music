import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import WebPlayerBar from '../../src/components/web-player-bar';
import WebMobileNavigation from '../../src/components/web-mobile-navigation';
import { webMiniPlayerBottom } from '../../src/components/player-layout';
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
jest.mock('../../src/components/performance-tabs', () => () => <nav><button>Home</button></nav>);
jest.mock('../../src/components/artwork-image', () => () => <img alt="Song artwork" />);
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
  const render = (expanded) => <><WebPlayerBar mobileBottom={webMiniPlayerBottom(0)} hidden={expanded} />{expanded ? <MobilePlayerSurface /> : null}</>;
  mockRouter.push.mockImplementation(() => root.render(render(true)));
  act(() => root.render(render(false)));
  act(() => pointer(container.querySelector('.crimson-mini-track'), 'pointerdown', 100, 700));
  act(() => pointer(window, 'pointermove', 100, 640));
  expect(mockRouter.push).toHaveBeenCalledWith('/player');
  expect(getWebPlayerMotion().position).toBe(618);
  expect(container.querySelector('[data-testid="mobile-player-surface"]').style.transform).toContain('translateY(618px)');
  // The mini has unmounted; its globally owned pointer stream remains active.
  act(() => pointer(window, 'pointermove', 100, 450));
  expect(getWebPlayerMotion().position).toBe(428);
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
  const render = (expanded) => <><WebPlayerBar mobileBottom={webMiniPlayerBottom(0)} hidden={expanded} />{expanded ? <MobilePlayerSurface /> : null}</>;
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


test('the morph draws exactly one cover without scaling the player controls', () => {
  const render = (expanded) => <><WebPlayerBar mobileBottom={webMiniPlayerBottom(0)} hidden={expanded} />{expanded ? <MobilePlayerSurface /> : null}</>;
  mockRouter.push.mockImplementation(() => root.render(render(true)));
  act(() => root.render(render(false)));
  act(() => pointer(container.querySelector('.crimson-mini-track'), 'pointerdown', 100, 710));
  act(() => pointer(window, 'pointermove', 100, 680));
  expect(container.querySelector('[data-testid="mobile-player-surface"]').querySelectorAll('img[alt="Song artwork"]')).toHaveLength(1);
  expect(container.querySelector('[data-testid="mobile-mini-player"]').style.visibility).toBe('hidden');
  expect(container.querySelector('[data-testid="player-morph-artwork"] img')).not.toBeNull();
  expect(container.querySelector('[data-testid="mobile-player-surface"]').style.transform).not.toContain('scale');
});

test('a slow lazy player route still paints its collapsed geometry before animating', () => {
  act(() => root.render(<WebPlayerBar mobileBottom={webMiniPlayerBottom(0)} />));
  act(() => container.querySelector('.crimson-mini-track').click());
  act(() => jest.advanceTimersByTime(1000));
  expect(getWebPlayerMotion().position).toBe(678);
  expect(getWebPlayerMotion().phase).toBe('dragging');
  act(() => root.render(<><WebPlayerBar hidden /><MobilePlayerSurface /></>));
  expect(container.querySelector('[data-testid="mobile-player-surface"]').style.transform).toBe('translateY(678px)');
  act(() => jest.advanceTimersByTime(40));
  expect(getWebPlayerMotion().phase).toBe('settling');
  expect(getWebPlayerMotion().position).toBe(0);
  act(() => jest.advanceTimersByTime(280));
  expect(getWebPlayerMotion().phase).toBe('rest');
});

test('navigation stays mounted and follows the drag instead of disappearing on route push', () => {
  let session;
  act(() => root.render(<WebMobileNavigation bottom={8} playerOpen={false} selectedGroup="(home)" />));
  const navigation = container.querySelector('[data-testid="mobile-navigation"]');
  const home = navigation.querySelector('button');
  act(() => { session = beginWebPlayerMotion(600, 678); });
  act(() => root.render(<WebMobileNavigation bottom={8} playerOpen selectedGroup="(home)" />));
  expect(navigation.querySelector('button')).toBe(home);
  expect(navigation.style.opacity).toBe('');
  expect(navigation.hasAttribute('inert')).toBe(true);
  act(() => settleWebPlayerMotion(session, true, false));
  expect(navigation.style.transition).toContain('280ms');
  expect(navigation.style.transform).toBe('translateY(72px)');
  expect(navigation.style.opacity).toBe('');
  act(() => root.render(<WebMobileNavigation bottom={8} playerOpen={false} selectedGroup="(home)" />));
  expect(navigation.style.transform).toBe('translateY(0px)');
  expect(navigation.hasAttribute('inert')).toBe(false);
});


test('returning from the expanded player reuses the loaded mini artwork', () => {
  const render = (expanded) => <><WebPlayerBar hidden={expanded} />{expanded ? <MobilePlayerSurface /> : null}</>;
  act(() => root.render(render(false)));
  const cover = container.querySelector('img');
  act(() => root.render(render(true)));
  expect(cover.closest('[inert]')).not.toBeNull();
  act(() => root.render(render(false)));
  expect(container.querySelector('img')).toBe(cover);
  expect(cover.closest('[inert]')).toBeNull();
});

test('grabbing a settling player resumes at its visible position', () => {
  act(() => root.render(<MobilePlayerSurface />));
  act(() => container.querySelector('[aria-label="Minimize player"]').click());
  act(() => jest.advanceTimersByTime(40));
  const surface = container.querySelector('[data-testid="mobile-player-surface"]');
  surface.getBoundingClientRect = () => ({ top: 240 });
  act(() => pointer(container.querySelector('[data-testid="header-handle"]'), 'pointerdown', 100, 300));
  act(() => pointer(window, 'pointermove', 100, 340));
  expect(getWebPlayerMotion().position).toBe(280);
  act(() => pointer(window, 'pointercancel', 100, 340));
  act(() => jest.advanceTimersByTime(500));
  expect(mockRouter.back).not.toHaveBeenCalled();
});


test('dragging keeps the dock material outside the fading and clipped player contents', () => {
  const render = (expanded) => <><WebPlayerBar mobileBottom={webMiniPlayerBottom(0)} hidden={expanded} />{expanded ? <MobilePlayerSurface /> : null}</>;
  mockRouter.push.mockImplementation(() => root.render(render(true)));
  act(() => root.render(render(false)));
  const restingMaterial = container.querySelector('.crimson-mini-track').parentElement.style;
  const tint = restingMaterial.backgroundColor;
  const blur = restingMaterial.backdropFilter;
  act(() => pointer(container.querySelector('.crimson-mini-track'), 'pointerdown', 100, 710));
  for (const y of [695, 660, 580]) {
    act(() => pointer(window, 'pointermove', 100, y));
    const material = container.querySelector('[data-testid="mobile-player-material"]');
    expect(material.style.backgroundColor).toBe(tint);
    expect(material.style.backdropFilter).toBe(blur);
    expect(material.style.WebkitBackdropFilter).toBe(blur);
    for (let ancestor = material; ancestor && ancestor !== container; ancestor = ancestor.parentElement) {
      expect(ancestor.style.opacity).toBe('');
      expect(ancestor.style.clipPath).toBe('');
    }
    // The fading compact controls do not add a second, isolated material.
    const copy = container.querySelector('[data-testid="mobile-player-surface"] .crimson-mini-track').parentElement;
    expect(copy.style.backgroundColor).toBe('transparent');
    expect(copy.style.backdropFilter).toBeUndefined();
  }
  act(() => pointer(window, 'pointercancel', 100, 580));
  act(() => jest.advanceTimersByTime(280));
});
