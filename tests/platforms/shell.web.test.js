import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import WebAppShell from '../../src/components/web-app-shell';
import { loadLibraryFeed } from '../../src/services/music';
import { requestSearchQuery, subscribeToSearchQuery } from '../../src/services/navigation-events';

let mockWidth = 1440;
let mockPathname = '/';
let mockSegments = ['(app)', '(home)'];
let mockRootState = { index: 0, routes: [{ name: '(app)' }] };
let mockUser = { uid: 'first', DisplayName: 'Listener' };
const mockRouter = { navigate: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const emptyFeed = { playlists: [], likedPlaylists: [], followedArtists: [] };

jest.mock('react-native-web/dist/exports/useWindowDimensions', () => () => ({ width: mockWidth, height: 900, scale: 1, fontScale: 1 }));
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  useSegments: () => mockSegments,
  useRootNavigationState: () => mockRootState,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 20, left: 0 }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('../../src/components/app-symbol', () => ({ SymbolView: () => null }));
jest.mock('../../src/components/frosted-surface', () => ({ FrostedBackdrop: () => null }));
jest.mock('../../src/components/playlist-cover', () => () => null);
jest.mock('../../src/components/main-header-actions', () => function MockHeaderActions() { return <><button aria-label="Open listening history" /><button aria-label="Open notifications" /></>; });
jest.mock('../../src/components/web-player-bar', () => function MockWebPlayerBar({ hidden, mobileBottom }) { return <output data-player-hidden={String(hidden)} data-player-bottom={mobileBottom} />; });
jest.mock('../../src/providers/auth-provider', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../src/providers/player-provider', () => ({ usePlayer: () => ({ currentSong: { id: 'playing' } }) }));
jest.mock('../../src/providers/settings-provider', () => ({ useAppSettings: () => ({
  isDark: true,
  colors: { background: '#000', elevated: '#111', surface: '#222', text: '#fff', secondaryText: '#aaa', border: '#333', accent: '#95f', accentSoft: '#325' },
}) }));
jest.mock('../../src/services/music', () => ({
  loadLibraryFeed: jest.fn(),
  readOfflineData: jest.fn(async () => null),
  readLocalListeningEvents: jest.fn(async () => []),
}));

let container;
let root;
const render = async () => { await act(async () => root.render(<WebAppShell><div data-testid="route-content">Current route</div></WebAppShell>)); };
const button = (label) => [...container.querySelectorAll('button')].find((node) => node.getAttribute('aria-label') === label || node.textContent === label);
const artistFeed = (id) => ({ ...emptyFeed, followedArtists: [{ id, name: `${id} artist`, image: '', imageSmall: '', followers: '1' }] });

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockWidth = 1440;
  mockPathname = '/';
  mockSegments = ['(app)', '(home)'];
  mockRootState = { index: 0, routes: [{ name: '(app)' }] };
  mockUser = { uid: 'first', DisplayName: 'Listener' };
  loadLibraryFeed.mockResolvedValue(emptyFeed);
  requestSearchQuery('');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

test('mobile switches to the Android tabs and removes desktop navigation at the responsive boundary', async () => {
  await render();
  expect(container.querySelector('.crimson-shell')?.className).toContain('is-desktop');
  expect(container.querySelector('aside')).not.toBeNull();
  expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
  mockWidth = 959;
  await render();
  expect(container.querySelector('aside')).toBeNull();
  expect(container.querySelector('header')).toBeNull();
  expect([...container.querySelectorAll('[role="tab"]')].map((node) => node.getAttribute('aria-label'))).toEqual(['Home', 'Search', 'Library', 'Account']);
  await act(async () => container.querySelector('[role="tab"][aria-label="Library"]').click());
  expect(mockRouter.navigate).toHaveBeenLastCalledWith('/(app)/(library)/library');
  expect(Number(container.querySelector('output').dataset.playerBottom)).toBeGreaterThan(62 + 20);
  mockPathname = '/player'; mockSegments = ['player'];
  await render();
  expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
  expect(container.querySelector('output').dataset.playerHidden).toBe('true');
  expect(container.querySelector('[data-testid="route-content"]')).not.toBeNull();
});

test('collection and player navigation keep the selected library tab and scoped detail routes', async () => {
  mockPathname = '/library'; mockSegments = ['(app)', '(library)', 'library'];
  const appRoute = { name: '(app)', state: { index: 0, routes: [{ name: '(library)' }] } };
  mockRootState = { index: 0, routes: [appRoute] };
  await render();
  expect(button('Library').getAttribute('aria-current')).toBe('page');
  await act(async () => button('Open Favorites').click());
  expect(mockRouter.navigate).toHaveBeenLastCalledWith(expect.objectContaining({ pathname: '/(app)/(library)/favorites' }));
  mockPathname = '/player'; mockSegments = ['player'];
  mockRootState = { index: 1, routes: [appRoute, { name: 'player' }] };
  await render();
  expect(button('Library').getAttribute('aria-current')).toBe('page');
  expect(container.querySelector('output').dataset.playerHidden).toBe('true');
  mockPathname = '/action-sheet'; mockSegments = ['action-sheet'];
  mockRootState = { index: 2, routes: [appRoute, { name: 'player' }, { name: 'action-sheet' }] };
  await render();
  expect(button('Library').getAttribute('aria-current')).toBe('page');
  expect(container.querySelector('output').dataset.playerHidden).toBe('true');
  await act(async () => button('Home').click());
  expect(mockRouter.navigate).toHaveBeenLastCalledWith('/(app)/(home)');
});

test('global search hands off a trimmed query even when the Search screen has not mounted', async () => {
  await render();
  const input = container.querySelector('[aria-label="Search music"]');
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setValue.call(input, '  ZYRA  ');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => input.closest('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(mockRouter.navigate).toHaveBeenLastCalledWith('/(app)/(search)/search');
  const received = jest.fn();
  const unsubscribe = subscribeToSearchQuery(received);
  expect(received).toHaveBeenCalledWith('ZYRA');
  unsubscribe();
});

test('the full search surface focuses its input and desktop actions sit beside the account button', async () => {
  await render();
  const form = container.querySelector('.crimson-global-search');
  const input = form.querySelector('input');
  await act(async () => form.click());
  expect(document.activeElement).toBe(input);
  input.blur();
  await act(async () => form.querySelector('kbd').click());
  expect(document.activeElement).toBe(input);
  expect([...container.querySelector('.crimson-toolbar-actions').querySelectorAll('button')].map((node) => node.getAttribute('aria-label'))).toEqual(['Open listening history', 'Open notifications', 'Open account settings']);
});

test('desktop search keeps the same input across main routes and shares typing, recent selections, and clearing', async () => {
  await render();
  const input = container.querySelector('[aria-label="Search music"]');
  const received = jest.fn();
  const unsubscribe = subscribeToSearchQuery(received);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  input.focus();
  for (const [pathname, group] of [['/search', '(search)'], ['/library', '(library)'], ['/', '(home)']]) {
    mockPathname = pathname;
    mockSegments = ['(app)', group];
    await render();
    expect(container.querySelector('[aria-label="Search music"]')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(container.querySelectorAll('header input')).toHaveLength(1);
  }
  await act(async () => {
    setValue.call(input, 'Wildfire');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(received).toHaveBeenLastCalledWith('Wildfire');
  await act(async () => requestSearchQuery('ZYRA'));
  expect(input.value).toBe('ZYRA');
  await act(async () => button('Clear search').click());
  expect(input.value).toBe('');
  expect(document.activeElement).toBe(input);
  expect(received).toHaveBeenLastCalledWith('');
  const lateSubscriber = jest.fn();
  subscribeToSearchQuery(lateSubscriber)();
  expect(lateSubscriber).toHaveBeenCalledWith('');
  unsubscribe();
});

test('a slow sidebar request cannot bring back the previous account’s library', async () => {
  let finishFirst;
  loadLibraryFeed.mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }));
  await render();
  mockUser = { uid: 'second', DisplayName: 'Second listener' };
  loadLibraryFeed.mockResolvedValueOnce(artistFeed('second'));
  await render();
  expect(button('Open second artist')).toBeDefined();
  await act(async () => finishFirst(artistFeed('first')));
  expect(button('Open first artist')).toBeUndefined();
  expect(button('Open second artist')).toBeDefined();
  mockUser = null;
  await render();
  expect(container.querySelector('aside')).toBeNull();
  expect(container.querySelector('output')).toBeNull();
  expect(container.querySelector('[data-testid="route-content"]')).not.toBeNull();
});
