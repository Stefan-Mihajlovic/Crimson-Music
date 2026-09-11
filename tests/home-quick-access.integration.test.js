import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import HomeQuickAccess from '../src/components/home-quick-access';
import { loadListeningHistoryPage } from '../src/services/music';

let mockUser;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-symbols', () => ({ SymbolView: 'SymbolView' }));
jest.mock('../src/components/playlist-cover', () => 'PlaylistCover');
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: {} }) }));
jest.mock('../src/providers/network-provider', () => ({ useNetwork: () => ({ isOffline: false }) }));
jest.mock('../src/providers/player-provider', () => ({ usePlayer: () => ({ playSong: jest.fn() }) }));
jest.mock('../src/providers/download-provider', () => ({ useDownloads: () => ({ downloadedSongs: [] }) }));
jest.mock('../src/services/action-sheet', () => ({ useDetailRoutes: () => ({}) }));
jest.mock('../src/services/music', () => ({
  loadListeningHistoryPage: jest.fn(),
  readOfflineData: jest.fn(async () => null),
  readLocalListeningEvents: jest.fn(async () => []),
}));

let root;
const page = (id) => ({ items: [{ song: { id, title: id, image: '' } }] });
const titles = () => root.root.findAllByType(Text).map((node) => node.props.children);
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockUser = { uid: 'first' };
  loadListeningHistoryPage.mockImplementation(async (uid) => page(`${uid}-song`));
});
afterEach(async () => { await act(async () => root.unmount()); });

test('account changes clear previous shortcuts while the new history is still loading', async () => {
  await act(async () => { root = create(<HomeQuickAccess />); });
  expect(titles()).toContain('first-song');
  let finish;
  loadListeningHistoryPage.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  mockUser = { uid: 'second' };
  await act(async () => root.update(<HomeQuickAccess />));
  expect(titles()).not.toContain('first-song');
  expect(titles()[0]).toBe('Favorites');
  await act(async () => finish(page('second-song')));
  expect(titles()).toContain('second-song');
});

test('a delayed response from the previous account cannot replace current shortcuts', async () => {
  let finishOld;
  loadListeningHistoryPage.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }));
  await act(async () => { root = create(<HomeQuickAccess />); });
  mockUser = { uid: 'second' };
  await act(async () => root.update(<HomeQuickAccess />));
  await act(async () => finishOld(page('first-song')));
  expect(titles()).toContain('second-song');
  expect(titles()).not.toContain('first-song');
});
