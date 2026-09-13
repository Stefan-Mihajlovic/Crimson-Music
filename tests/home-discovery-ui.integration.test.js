import React from 'react';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import HomeDiscovery from '../src/components/home-discovery';
import HomeDiscoverySections from '../src/components/home-discovery-sections';
import { loadHomeDiscovery, loadHomeSpotlightTracks } from '../src/services/home-discovery';

let mockUid = 'listener';
let mockOffline = false;
let mockDataSaver = false;
const mockPlay = jest.fn();
const mockColors = { accent: '#965CFF', text: '#fff', secondaryText: '#aaa' };
jest.mock('expo-image', () => ({ Image: 'Artwork' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('../src/components/artist-spotlight', () => 'Spotlight');
jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'Symbol' }));
jest.mock('../src/components/now-playing-artwork', () => 'NowPlayingArtwork');
jest.mock('../src/components/song-list-row', () => 'SongListRow');
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { uid: mockUid } }) }));
jest.mock('../src/providers/network-provider', () => ({ useNetwork: () => ({ isOffline: mockOffline }) }));
jest.mock('../src/providers/player-provider', () => ({ usePlayer: () => ({ playSong: mockPlay }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: mockColors, reduceMotion: true, dataSaver: mockDataSaver }) }));
jest.mock('../src/services/home-discovery', () => ({ loadHomeDiscovery: jest.fn(), loadHomeSpotlightTracks: jest.fn() }));

let root;
const song = (id, extra = {}) => ({ id, title: id, creator: 'Artist', streamable: true, ...extra });
const artist = { id: 'artist', name: 'The artist' };
const base = () => ({ underground: [], contentWidth: 353,
  onPlaySong: jest.fn(), onSongMenu: jest.fn() });
const controller = () => ({ artist, profile: { favoriteCategories: ['electronic', 'pop'] }, rotation: 1,
  excludeTrackIds: [], contentWidth: 353, onOpenArtist: jest.fn(), onArtistMenu: jest.fn(), onSongMenu: jest.fn() });
const mount = async (element) => { await act(async () => { root = create(element); }); };
const rows = () => root.root.findAllByType('SongListRow');
const renderedText = () => root.root.findAllByType(Text).map((item) => item.props.children).flat().join(' ');
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockUid = 'listener'; mockOffline = false; mockDataSaver = false;
  loadHomeDiscovery.mockResolvedValue({ underground: [] });
  loadHomeSpotlightTracks.mockResolvedValue([song('spotlight-track')]);
});
afterEach(async () => { if (root) await act(async () => root.unmount()); root = undefined; });

test('Underground uses song rows, filters repeated/unplayable tracks, and plays its own queue', async () => {
  const props = base();
  props.excludeTrackIds = ['already-shown'];
  props.underground = [song('already-shown'), song('gem'), song('gem'), song('blocked', { streamable: false }), song('gem-two')];
  await mount(<HomeDiscoverySections {...props} />);
  expect(rows().map((row) => row.props.song.id)).toEqual(['gem', 'gem-two']);
  await act(async () => rows()[1].props.onPress());
  expect(props.onPlaySong).toHaveBeenLastCalledWith(song('gem-two'), [song('gem'), song('gem-two')], 'Underground gems');
});

test('the row queue is bounded to the eight visible songs', async () => {
  const props = { ...base(), underground: Array.from({ length: 12 }, (_, i) => song(`gem-${i}`)) };
  await mount(<HomeDiscoverySections {...props} />);
  expect(rows()).toHaveLength(8);
  await act(async () => rows()[7].props.onPress());
  expect(props.onPlaySong.mock.calls[0][1]).toEqual(props.underground.slice(0, 8));
});

test('row menus act independently and the removed sections do not render', async () => {
  const props = { ...base(), underground: [song('gem')] };
  await mount(<HomeDiscoverySections {...props} />);
  await act(async () => rows()[0].props.onMenuPress());
  expect(props.onSongMenu).toHaveBeenCalledWith(song('gem'));
  expect(props.onPlaySong).not.toHaveBeenCalled();
  expect(renderedText()).toContain('Underground gems');
  expect(renderedText()).not.toContain('Most shared');
  expect(renderedText()).not.toContain('Explore');
});

test('an empty optional feed leaves no empty heading or placeholder section', async () => {
  await mount(<HomeDiscoverySections {...base()} />);
  expect(root.toJSON()).toBeNull();
});

test('Home can start without a spotlight artist even when the optional request fails', async () => {
  loadHomeDiscovery.mockRejectedValue(new Error('offline'));
  await mount(<HomeDiscovery {...controller()} artist={null} />);
  expect(root.root.findAllByType('Spotlight')).toHaveLength(0);
  expect(loadHomeSpotlightTracks).not.toHaveBeenCalled();
  expect(rows()).toHaveLength(0);
});

test('spotlight Play starts only its artist queue, while profile opens independently', async () => {
  const props = controller();
  await mount(<HomeDiscovery {...props} />);
  const spotlight = root.root.findByType('Spotlight');
  expect(spotlight.props.loading).toBe(false);
  await act(async () => spotlight.props.onPlay());
  expect(mockPlay).toHaveBeenLastCalledWith(song('spotlight-track'), [song('spotlight-track')], artist.name);
  await act(async () => spotlight.props.onOpen());
  expect(props.onOpenArtist).toHaveBeenCalledWith(artist);
});

test('switching account discards a late shelf response and clears the previous artist queue', async () => {
  let resolveOld;
  loadHomeDiscovery.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  const props = controller();
  await mount(<HomeDiscovery {...props} />);
  mockUid = 'next-listener';
  loadHomeDiscovery.mockResolvedValue({ underground: [song('new-account')] });
  loadHomeSpotlightTracks.mockResolvedValue([]);
  await act(async () => root.update(<HomeDiscovery {...props} />));
  await act(async () => resolveOld({ underground: [song('old-account')] }));
  expect(rows().map((row) => row.props.song.id)).toEqual(['new-account']);
  expect(root.root.findByType('Spotlight').props.songs).toEqual([]);
});

test('a late artist request cannot attach the wrong queue to a new spotlight', async () => {
  let resolveOld;
  loadHomeSpotlightTracks.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  const props = controller();
  await mount(<HomeDiscovery {...props} />);
  loadHomeSpotlightTracks.mockResolvedValue([song('new-artist-track')]);
  await act(async () => root.update(<HomeDiscovery {...props} artist={{ id: 'other', name: 'Other' }} />));
  await act(async () => resolveOld([song('old-artist-track')]));
  expect(root.root.findByType('Spotlight').props.songs.map((item) => item.id)).toEqual(['new-artist-track']);
});

test('offline mode requests cached content only and preference changes reload the shelves', async () => {
  mockOffline = true;
  const props = controller();
  await mount(<HomeDiscovery {...props} />);
  expect(loadHomeDiscovery).toHaveBeenLastCalledWith('listener', props.profile, 1, { offlineOnly: true });
  expect(loadHomeSpotlightTracks).toHaveBeenLastCalledWith('artist', 'listener', { offlineOnly: true });
  const profile = { favoriteCategories: ['jazz', 'classical'] };
  await act(async () => root.update(<HomeDiscovery {...props} profile={profile} />));
  expect(loadHomeDiscovery).toHaveBeenLastCalledWith('listener', profile, 1, { offlineOnly: true });
});
