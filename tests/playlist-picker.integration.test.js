import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import ActionSheetScreen from '../src/app/action-sheet';
import { loadLibraryFeed, getMusicTrack, getUserCollectionState, toggleUserCollectionItem } from '../src/services/music';
import { playlistPickerArtwork } from '../src/services/playlist-artwork';
import { assertNativeSheetLayout } from './helpers/assert-native-sheet-layout';

let mockParams = { type: 'song', id: 'remote', title: 'Song', subtitle: 'Artist' };
jest.mock('expo-router', () => ({ useRouter: () => ({ canGoBack: () => true, dismiss: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'SymbolView' }));
jest.mock('../src/components/responsive-popup', () => function Popup({ children }) { return children; });
jest.mock('../src/components/playlist-cover', () => 'PlaylistCover');
jest.mock('../src/components/favorites-artwork', () => 'FavoritesArtwork');
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { uid: 'listener' } }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: {}, reduceMotion: true }) }));
jest.mock('../src/providers/player-provider', () => ({ usePlayer: () => ({}) }));
jest.mock('../src/providers/download-provider', () => ({ useDownloads: () => ({ supported: false, statusFor: () => ({ state: 'none' }), isDownloaded: () => false, isTrackKnownUnavailable: () => false }) }));
jest.mock('../src/services/action-sheet', () => ({ useDetailRoutes: () => ({}) }));
jest.mock('../src/services/music', () => ({ getUserCollectionState: jest.fn(), getMusicTrack: jest.fn(), loadLibraryFeed: jest.fn(), normalizeRemoteImageUrl: (value) => value, toggleUserCollectionItem: jest.fn() }));
jest.mock('../src/services/playlist-artwork', () => ({ playlistPickerArtwork: jest.fn() }));
jest.mock('../src/services/local-music', () => ({ isLocalTrackId: (id) => id.startsWith('local:'), removeLocalMusic: jest.fn() }));
let root;
const press = async (label) => act(async () => root.root.findAll((node) => typeof node.props.onPress === 'function').find((row) => row.props.accessibilityLabel === label).props.onPress());
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockParams = { type: 'song', id: 'remote', title: 'Song', subtitle: 'Artist' };
  getUserCollectionState.mockResolvedValue(false);
  getMusicTrack.mockResolvedValue({ id: 'remote', source: 'audius' });
  toggleUserCollectionItem.mockResolvedValue(true);
  const playlist = { id: 'p1', source: 'audius', title: 'My playlist', songs: [], image: 'https://custom-cover', imageSmall: '' };
  loadLibraryFeed.mockResolvedValue({ playlists: [playlist] });
  playlistPickerArtwork.mockImplementation(async (item) => item);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test('Add to playlist offers creation before Favorites and displays each playlist cover with independent membership', async () => {
  await act(async () => { root = create(<ActionSheetScreen />); });
  assertNativeSheetLayout(root.root, { header: false });
  await press('Add to playlist');
  assertNativeSheetLayout(root.root, { list: true });
  expect(root.root.findAllByType('FavoritesArtwork')).toHaveLength(1);
  expect(root.root.findAllByType('PlaylistCover')[0].props.playlist.image).toBe('https://custom-cover');
  const destinations = root.root.findAll((node) => typeof node.props.onPress === 'function').map((row) => row.props.accessibilityLabel).filter(Boolean);
  expect(destinations.indexOf('Create new playlist')).toBeLessThan(destinations.indexOf('Add to Favorites'));
  expect(destinations.indexOf('Add to Favorites')).toBeLessThan(destinations.indexOf('Add to My playlist'));
  await press('Add to Favorites');
  expect(toggleUserCollectionItem).toHaveBeenCalledWith('listener', 'LikedSongs', 'remote', undefined, undefined);
  expect(root.root.findAll((node) => typeof node.props.onPress === 'function').some((row) => row.props.accessibilityLabel === 'Remove from Favorites')).toBe(true);
});

test('local audio offers Favorites and owned playlists', async () => {
  mockParams.id = 'local:import:first.mp3';
  await act(async () => { root = create(<ActionSheetScreen />); });
  await press('Add to playlist');
  expect(loadLibraryFeed).toHaveBeenCalledWith('listener', { selectedTrackId: mockParams.id });
  expect(root.root.findAllByType('FavoritesArtwork')).toHaveLength(1);
  expect(root.root.findAllByType('PlaylistCover')).toHaveLength(1);
});
