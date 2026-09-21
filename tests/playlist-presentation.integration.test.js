import React from 'react';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import PlaylistDetailScreen from '../src/app/playlist';
import { getUserCollectionState, loadPlaylistDetail, toggleUserCollectionItem } from '../src/services/music';

let mockParams = { id: 'playlist' };
let mockOffline = false;
const mockRefresh = jest.fn();
const mockDownloads = { supported: true, enabled: true, ready: true, isDownloaded: (id) => id === 'one', songsForCollection: () => [], isCollectionRequested: () => true, isCollectionDownloaded: () => false, statusFor: () => ({ state: 'none' }), isTrackUnavailableForCollection: (_, id) => id === 'two', downloadSongs: jest.fn() };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => ({ back: jest.fn() }) }));
jest.mock('../src/components/playlist-collection-screen', () => 'PlaylistPresentation');
const mockOpenEditor = jest.fn();
jest.mock('../src/components/playlist-editor', () => ({ usePlaylistEditor: () => mockOpenEditor }));
jest.mock('../src/components/bouncy-pressable', () => 'CollectionAction');
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { uid: 'listener' } }) }));
jest.mock('../src/providers/download-provider', () => ({ useDownloads: () => mockDownloads }));
jest.mock('../src/providers/network-provider', () => ({ useNetwork: () => ({ isOffline: mockOffline }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: {} }) }));
jest.mock('../src/services/music', () => ({ loadPlaylistDetail: jest.fn(), getUserCollectionState: jest.fn(), toggleUserCollectionItem: jest.fn() }));
jest.mock('../src/services/navigation-events', () => ({ subscribeToLibraryRefresh: () => () => undefined, requestLibraryRefresh: () => mockRefresh() }));
let root;
const songs = [{ id: 'one', title: 'First' }, { id: 'two', title: 'Second' }];
const playlist = { id: 'playlist', source: 'audius', title: 'Existing playlist', artists: 'Creator', songs: ['one', 'two'] };
const presentation = () => root.root.findByType('PlaylistPresentation');
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mockParams = { id: 'playlist' }; mockOffline = false; loadPlaylistDetail.mockResolvedValue({ playlist, songs }); getUserCollectionState.mockResolvedValue(false); toggleUserCollectionItem.mockResolvedValue(true); mockDownloads.downloadSongs.mockResolvedValue({ failed: 0 }); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = undefined; });

test('existing playlist retains library toggle and collection download ownership after presentation extraction', async () => {
  await act(async () => { root = create(<PlaylistDetailScreen />); });
  expect(presentation().props.songs).toEqual(songs);
  expect(presentation().props.expectedOffline).toBe(true);
  expect(presentation().props.unavailableForOffline('two')).toBe(true);
  await act(async () => presentation().props.actions.find((action) => action.label === 'Save playlist to library').onPress());
  expect(toggleUserCollectionItem).toHaveBeenCalledWith('listener', 'LikedPlaylists', 'playlist', playlist);
  expect(presentation().props.actions[0].selected).toBe(true);
  await act(async () => presentation().props.actions.find((action) => action.label.startsWith('Make ')).onPress());
  expect(mockDownloads.downloadSongs).toHaveBeenCalledWith(songs, 'manual', 'playlist:playlist');
});

test('owned playlists launch the native editor and retain reordered saved songs', async () => {
  mockParams.owned = '1';
  loadPlaylistDetail.mockResolvedValue({ playlist: { ...playlist, owned: true }, songs });
  await act(async () => { root = create(<PlaylistDetailScreen />); });
  expect(presentation().props.actions.some((action) => action.icon === 'heart')).toBe(false);
  await act(async () => presentation().props.actions.find((action) => action.label === 'Edit playlist').onPress());
  const editor = mockOpenEditor.mock.calls[0][0];
  expect(editor.playlist.id).toBe('playlist');
  await act(async () => editor.onSaved({ ...playlist, owned: true, songs: ['two', 'one'] }));
  expect(presentation().props.songs.map((song) => song.id)).toEqual(['two', 'one']);
  expect(root.root.findAllByType('PlaylistEditor')).toHaveLength(0);
  expect(mockRefresh).toHaveBeenCalled();
});

test('offline playlists still request cached detail and filter to playable saved songs', async () => {
  mockOffline = true;
  await act(async () => { root = create(<PlaylistDetailScreen />); });
  expect(loadPlaylistDetail).toHaveBeenCalledWith('playlist', 'listener', false, undefined, { offlineOnly: true });
  expect(presentation().props.songs).toEqual([songs[0]]);
});
