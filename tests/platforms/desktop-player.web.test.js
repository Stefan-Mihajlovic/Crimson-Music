import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getDesktopPlayerPresented } from '../../src/services/desktop-player-presentation';
import DesktopPlayer from '../../src/components/desktop-player';

let mockPreventRemove;
let mockReduced = false;
const mockDispatch = jest.fn();
const mockBack = jest.fn();
const mockRouter = { canGoBack: () => true, back: mockBack };
jest.mock('expo-router', () => ({ useIsFocused: () => true, useRouter: () => mockRouter, useNavigation: () => ({ dispatch: mockDispatch }) }));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: (_, callback) => { mockPreventRemove = callback; } }));
jest.mock('../../src/components/player-artwork-background', () => () => null);
jest.mock('../../src/components/artwork-image', () => () => null);
jest.mock('../../src/components/app-symbol', () => ({ SymbolView: () => null }));
jest.mock('../../src/components/desktop-player-panel', () => () => <div>Queue</div>);
jest.mock('../../src/providers/player-provider', () => ({
  usePlayer: () => ({ currentSong: { id: '1', title: 'Song', creator: 'Artist' } }),
  usePlayerStatus: () => ({ currentTime: 0, duration: 180 }),
}));
jest.mock('../../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { background: '#000', text: '#fff' }, reduceMotion: mockReduced }) }));
jest.mock('../../src/services/action-sheet', () => ({ useDetailRoutes: () => ({}), actionSheetHref: () => '/action-sheet' }));
jest.mock('../../src/components/web-player-controls', () => ({
  formatPlayerTime: () => '0:00', PlayerRange: () => null, WebTransport: () => null, WebVolume: () => null,
  PlayerIconButton: ({ label, onPress }) => <button aria-label={label} onClick={onPress} />,
}));
let root, container, animations, originalAnimate;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockReduced = false;
  animations = [];
  originalAnimate = HTMLElement.prototype.animate;
  HTMLElement.prototype.animate = jest.fn((frames, options) => {
    let finish;
    const finished = new Promise((resolve) => { finish = resolve; });
    const animation = { frames, options, finished, finish, cancel: jest.fn() };
    animations.push(animation);
    return animation;
  });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); HTMLElement.prototype.animate = originalAnimate; });

test('player enters with a short reveal and retains the route until the closing animation finishes', async () => {
  await act(async () => root.render(<DesktopPlayer />));
  expect(animations[0].frames[0].transform).toBe('translateY(24px)');
  expect(getDesktopPlayerPresented()).toBe(true);
  act(() => container.querySelector('[aria-label="Minimize player"]').click());
  expect(mockBack).toHaveBeenCalledTimes(1);
  const action = { type: 'GO_BACK' };
  act(() => mockPreventRemove({ data: { action } }));
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(getDesktopPlayerPresented()).toBe(false);
  expect(animations[1].frames[1].transform).toBe('translateY(24px)');
  act(() => mockPreventRemove({ data: { action } }));
  expect(animations).toHaveLength(2);
  await act(async () => animations[1].finish());
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockDispatch).toHaveBeenCalledWith(action);
});

test('reduced motion dismisses immediately without creating animations', async () => {
  mockReduced = true;
  await act(async () => root.render(<DesktopPlayer />));
  const action = { type: 'GO_BACK' };
  act(() => mockPreventRemove({ data: { action } }));
  expect(animations).toHaveLength(0);
  expect(mockDispatch).toHaveBeenCalledWith(action);
});

test('unmounting during close cannot dispatch stale navigation', async () => {
  await act(async () => root.render(<DesktopPlayer />));
  act(() => mockPreventRemove({ data: { action: { type: 'GO_BACK' } } }));
  await act(async () => root.render(null));
  await act(async () => animations[1].finish());
  expect(mockDispatch).not.toHaveBeenCalled();
});
