import React from 'react';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { Platform } from 'react-native';
import { act, create } from 'react-test-renderer';
import YourMixes from '../src/components/your-mixes';
import PersonalMixScreen from '../src/app/(app)/(home)/mix';
import { setPersonalMixBookmarked } from '../src/services/personal-mixes';

let mockParams = { id: 'daily' };
let mockMixes = [];
let mockOffline = false;
const mockPush = jest.fn();
const mockPlaySong = jest.fn();
const mockRefreshLibrary = jest.fn();
const mockDefinitions = [
  { id: 'daily', title: 'Daily Mix', period: 'daily' }, { id: 'weekly', title: 'Weekly Mix', period: 'weekly' },
  { id: 'monthly', title: 'Monthly Mix', period: 'monthly' }, { id: 'release-radar', title: 'Release Radar', period: 'weekly' },
  { id: 'rediscover', title: 'Rediscover', period: 'weekly' }, { id: 'hidden-gems', title: 'Hidden Gems', period: 'weekly' },
];
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useLocalSearchParams: () => mockParams, Stack: { Screen: () => null } }));
jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'Symbol' }));
jest.mock('../src/components/personal-mix-cover', () => 'MixCover');
jest.mock('../src/components/detail-song-row', () => 'SongRow');
jest.mock('../src/components/collection-tools', () => ({ __esModule: true, default: 'CollectionTools', collectionDuration: () => '6 min', collectionSongs: (songs) => songs }));
jest.mock('../src/components/bouncy-pressable', () => 'CollectionAction');
jest.mock('../src/components/playlist-cover', () => 'PlaylistCover');
jest.mock('../src/components/collection-header-play-button', () => ({ __esModule: true, default: 'HeaderPlay', useCollectionHeaderPlaybackVisibility: () => ({ visible: false, onScroll: jest.fn() }) }));
jest.mock('../src/hooks/use-personal-mixes', () => ({ usePersonalMixes: () => ({ mixes: mockMixes, loading: false, error: false, refresh: jest.fn() }) }));
jest.mock('../src/hooks/use-collection-playback', () => ({ useCollectionPlayback: () => ({ playing: false, loading: false, toggleCollectionPlayback: jest.fn() }) }));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { uid: 'listener' } }) }));
jest.mock('../src/providers/network-provider', () => ({ useNetwork: () => ({ isOffline: mockOffline }) }));
jest.mock('../src/providers/player-provider', () => ({ usePlayer: () => ({ playSong: mockPlaySong }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { text: '#FFF', secondaryText: '#AAA', accent: '#F26', background: '#111', controlSurface: '#222', border: '#333' } }) }));
jest.mock('../src/services/action-sheet', () => ({ actionSheetHref: (value) => value, useDetailRoutes: () => ({ playlistHref: (id) => `/playlist?id=${id}` }) }));
jest.mock('../src/services/navigation-events', () => ({ requestLibraryRefresh: () => mockRefreshLibrary() }));
jest.mock('../src/services/personal-mixes', () => ({ get personalMixDefinitions() { return mockDefinitions; }, personalMixDefinition: (id) => mockDefinitions.find((definition) => definition.id === id), setPersonalMixBookmarked: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34 }) }));
let root;
const mix = (id) => ({ id, owner: 'listener', periodKey: '2026-09-15', createdAt: 0, refreshAt: new Date(2026, 8, 16).getTime(), status: 'ready', bookmarked: false, songs: [{ id: `${id}-one`, title: 'First', creator: 'Artist' }, { id: `${id}-two`, title: 'Second', creator: 'Artist' }] });
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mockMixes = mockDefinitions.map((definition) => mix(definition.id)); mockParams = { id: 'daily' }; mockOffline = false; setPersonalMixBookmarked.mockImplementation(async (_uid, _id, value) => value); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = undefined; Platform.OS = 'ios'; });

test.each(['ios', 'android', 'web'])('%s Home uses playlist cards with real edition songs and no heart overlays', async (platform) => {
  Platform.OS = platform;
  await act(async () => { root = create(<YourMixes />); });
  expect(root.root.findAllByType('MixCover').map((node) => node.props.id)).toEqual(mockDefinitions.map((definition) => definition.id));
  await act(async () => root.root.findByProps({ accessibilityLabel: 'Open Monthly Mix' }).props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(app)/(home)/mix', params: { id: 'monthly' } });
  expect(root.root.findAllByType('MixCover')[1].props.songs).toEqual(mockMixes[1].songs);
  expect(root.root.findAll((node) => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.includes('Like and save'))).toHaveLength(0);
  expect(setPersonalMixBookmarked).not.toHaveBeenCalled();
});

test('mix detail plays the complete edition starting at a chosen song', async () => {
  await act(async () => { root = create(<PersonalMixScreen />); });
  const rows = root.root.findAllByType('SongRow');
  expect(rows).toHaveLength(2);
  await act(async () => rows[1].props.onPress());
  expect(mockPlaySong).toHaveBeenLastCalledWith(mockMixes[0].songs[1], mockMixes[0].songs, 'Daily Mix · 2026-09-15', 'mix:daily:2026-09-15');
});

test('widget play intent starts the loaded mix once and does not restart on refresh', async () => {
  mockParams = { id: 'daily', play: '1' };
  await act(async () => { root = create(<PersonalMixScreen />); });
  expect(mockPlaySong).toHaveBeenCalledTimes(1);
  expect(mockPlaySong).toHaveBeenCalledWith(mockMixes[0].songs[0], mockMixes[0].songs, 'Daily Mix · 2026-09-15', 'mix:daily:2026-09-15');
  mockMixes = mockMixes.map((value) => ({ ...value }));
  await act(async () => root.update(<PersonalMixScreen />));
  expect(mockPlaySong).toHaveBeenCalledTimes(1);
});

test('offline and empty editions keep their detail route without exposing homepage save controls', async () => {
  mockOffline = true;
  mockMixes[0].songs = [];
  await act(async () => { root = create(<YourMixes />); });
  await act(async () => root.root.findByProps({ accessibilityLabel: 'Open Daily Mix' }).props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/(app)/(home)/mix', params: { id: 'daily' } });
  expect(root.root.findAll((node) => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.includes('Like and save'))).toHaveLength(0);
  expect(setPersonalMixBookmarked).not.toHaveBeenCalled();
});


test('mix detail heart bookmarks and unbookmarks the live mix without opening or creating an Audius playlist', async () => {
  let complete;
  setPersonalMixBookmarked.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  await act(async () => { root = create(<PersonalMixScreen />); });
  const heart = root.root.findByProps({ accessibilityLabel: 'Save mix to library' });
  expect(heart.type).toBe('CollectionAction');
  expect(heart.findByType('Symbol').props.name).toBe('heart');
  await act(async () => { heart.props.onPress(); heart.props.onPress(); });
  expect(setPersonalMixBookmarked).toHaveBeenCalledTimes(1);
  expect(setPersonalMixBookmarked).toHaveBeenCalledWith('listener', 'daily', true);
  await act(async () => complete(true));
  const saved = root.root.findByProps({ accessibilityLabel: 'Remove mix from library' });
  expect(saved.findByType('Symbol').props.name).toBe('heart.fill');
  await act(async () => saved.props.onPress());
  expect(setPersonalMixBookmarked).toHaveBeenLastCalledWith('listener', 'daily', false);
  expect(root.root.findByProps({ accessibilityLabel: 'Save mix to library' })).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
});

test('a new widget request plays the same mounted mix again but an unchanged request does not', async () => {
  mockParams = { id: 'daily', play: '1', playRequest: 'first' };
  await act(async () => { root = create(<PersonalMixScreen />); });
  await act(async () => root.update(<PersonalMixScreen />));
  expect(mockPlaySong).toHaveBeenCalledTimes(1);
  mockParams = { ...mockParams, playRequest: 'second' };
  await act(async () => root.update(<PersonalMixScreen />));
  expect(mockPlaySong).toHaveBeenCalledTimes(2);
  await act(async () => root.update(<PersonalMixScreen />));
  expect(mockPlaySong).toHaveBeenCalledTimes(2);
});

test('offline mix detail keeps cached songs playable and allows local bookmarking', async () => {
  mockOffline = true;
  await act(async () => { root = create(<PersonalMixScreen />); });
  expect(root.root.findAllByType('SongRow')).toHaveLength(2);
  expect(root.root.findByProps({ accessibilityLabel: 'Save mix to library' }).props.disabled).toBe(false);
  await act(async () => root.root.findByProps({ accessibilityLabel: 'Save mix to library' }).props.onPress());
  expect(setPersonalMixBookmarked).toHaveBeenCalledWith('listener', 'daily', true);
  expect(root.root.findAllByType('CollectionTools')).toHaveLength(1);
});

test('mix hero hides the cover title and a bookmarked heart removes the bookmark without navigation', async () => {
  mockMixes[0] = { ...mockMixes[0], bookmarked: true };
  await act(async () => { root = create(<PersonalMixScreen />); });
  expect(root.root.findByType('MixCover').props.showTitle).toBe(false);
  await act(async () => root.root.findByProps({ accessibilityLabel: 'Remove mix from library' }).props.onPress());
  expect(setPersonalMixBookmarked).toHaveBeenCalledWith('listener', 'daily', false);
  expect(mockPush).not.toHaveBeenCalled();
});
