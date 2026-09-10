import { beforeEach, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createOwnedPlaylist,
  getUserCollectionState,
  loadFavoriteSongs,
  loadHomeFeed,
  loadLibraryFeed,
  loadListeningHistoryPage,
  loadMonthlyListeningStats,
  recordListeningEvent,
  setSongInOwnedPlaylist,
  toggleUserCollectionItem,
} from '../src/services/music';
import { audiusRequest, getCurrentAudiusUserId } from '../src/services/audius-session';
import { reportError } from '../src/services/telemetry';
import { getAudiusArtist, getTopAudiusArtists, getRecommendedAudiusTracks, getTrendingAudiusTracks } from '../src/services/audius';
import { setDataSaverEnabled } from '../src/services/data-usage';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/services/audius-session', () => ({ audiusRequest: jest.fn(), getCurrentAudiusUserId: jest.fn() }));
jest.mock('../src/services/telemetry', () => ({ reportError: jest.fn() }));
jest.mock('../src/services/audius', () => ({
  ...jest.requireActual('../src/services/audius'),
  getAudiusArtist: jest.fn(),
  getTopAudiusArtists: jest.fn(),
  getTrendingAudiusTracks: jest.fn(),
  getRecommendedAudiusTracks: jest.fn(),
}));

const artwork = { small: '', medium: '', large: '', mirrors: [] };
function song(id) {
  return { id, source: 'audius', title: `Track ${id}`, creator: 'Artist', artistId: 'artist', artistHandle: 'artist', image: '', imageSmall: '', artwork, url: '', duration: 180, streamable: true, downloadable: true, tags: [], genre: 'Electronic', mood: '', categories: '' };
}
function playlist(id, tracks = []) {
  return { id, playlist_name: `Playlist ${id}`, user: { id: 'owner', name: 'Listener' }, playlist_contents: tracks.map((id) => ({ track_id: id, timestamp: 123 })) };
}

beforeEach(async () => {
  setDataSaverEnabled(false);
  jest.clearAllMocks();
  audiusRequest.mockReset();
  await AsyncStorage.clear();
  getCurrentAudiusUserId.mockReturnValue('owner');
  getAudiusArtist.mockResolvedValue({ id: 'owner', name: 'Listener', image: '', imageSmall: '' });
  getTopAudiusArtists.mockResolvedValue([]);
  getTrendingAudiusTracks.mockResolvedValue([song('trending')]);
  getRecommendedAudiusTracks.mockResolvedValue([song('recommended')]);
  audiusRequest.mockResolvedValue({ data: [] });
});

test('Audius library unwraps saved playlists and preserves complete playlist membership', async () => {
  audiusRequest.mockImplementation(async (path) => {
    if (path.includes('/library/playlists')) return { data: [{ item: playlist('liked') }] };
    if (path.includes('/following')) return { data: [{ id: 'artist', name: 'Followed artist' }] };
    return { data: [playlist('owned', ['first', 'track-499'])] };
  });
  const feed = await loadLibraryFeed('owner', { selectedTrackId: 'track-499' });
  expect(feed.playlists[0]).toMatchObject({ source: 'audius', owned: true, songs: ['first', 'track-499'] });
  expect(feed.likedPlaylists[0].id).toBe('liked');
  expect(feed.followedArtists[0].id).toBe('artist');
  expect(audiusRequest).toHaveBeenCalledTimes(3);
  expect(audiusRequest.mock.calls.every(([path]) => path.includes('user_id=owner'))).toBe(true);
});

test('Audius favorites paginate beyond the first hundred and unwrap activity items', async () => {
  audiusRequest.mockImplementation(async (path) => ({ data: Array.from({ length: path.includes('offset=100') ? 1 : 100 }, (_, index) => ({ item: { id: `${path.includes('offset=100') ? 'last' : index}`, title: 'Saved track', user: { name: 'Artist' } } })) }));
  const favorites = await loadFavoriteSongs('owner');
  expect(favorites).toHaveLength(101);
  expect(favorites[100].id).toBe('last');
  expect(audiusRequest).toHaveBeenCalledTimes(2);
});

test('failed picker refresh does not substitute an offline library snapshot', async () => {
  await loadLibraryFeed('owner');
  audiusRequest.mockRejectedValue(new Error('offline'));
  await expect(loadLibraryFeed('owner', { selectedTrackId: 'track' })).rejects.toThrow('offline');
});

test('follows and favorites use the logged-in Audius user and correct mutation endpoint', async () => {
  audiusRequest.mockResolvedValueOnce({ data: { does_current_user_follow: false } }).mockResolvedValueOnce({ transaction_hash: 'confirmed' });
  await expect(toggleUserCollectionItem('owner', 'FollowedArtists', 'artist')).resolves.toBe(true);
  expect(audiusRequest).toHaveBeenLastCalledWith('/users/artist/follow?user_id=owner', { method: 'POST' });
  audiusRequest.mockResolvedValueOnce({ data: { has_current_user_saved: true } }).mockResolvedValueOnce({ transaction_hash: 'confirmed' });
  await expect(toggleUserCollectionItem('owner', 'LikedSongs', 'track')).resolves.toBe(false);
  expect(audiusRequest).toHaveBeenLastCalledWith('/tracks/track/favorites?user_id=owner', { method: 'DELETE' });
});

test('failed Audius writes reject, and missing state never guesses whether an item is saved', async () => {
  audiusRequest.mockResolvedValueOnce({ data: { has_current_user_saved: false } }).mockRejectedValueOnce(new Error('Write permission required'));
  await expect(toggleUserCollectionItem('owner', 'LikedSongs', 'failed-track')).rejects.toThrow('Write permission required');
  audiusRequest.mockResolvedValueOnce({ data: {} });
  await expect(getUserCollectionState('owner', 'LikedSongs', 'missing-state')).rejects.toThrow('confirm your library state');
});

test('playlist writes retain timestamp metadata and enforce Audius ownership', async () => {
  audiusRequest.mockResolvedValueOnce({ data: [playlist('mine', ['existing'])] }).mockResolvedValueOnce({ transaction_hash: 'confirmed' });
  await expect(setSongInOwnedPlaylist('owner', 'mine', 'new', true)).resolves.toBe(true);
  expect(audiusRequest).toHaveBeenLastCalledWith('/playlists/mine?user_id=owner', {
    method: 'PUT', body: { playlist_contents: [{ track_id: 'existing', timestamp: 123 }, { track_id: 'new', timestamp: expect.any(Number) }] },
  });
  audiusRequest.mockResolvedValueOnce({ data: [{ ...playlist('theirs'), user: { id: 'someone-else' } }] });
  await expect(setSongInOwnedPlaylist('owner', 'theirs', 'new', true)).rejects.toThrow('owned by your Audius');
});

test('playlist creation uses Audius server ID and never uploads a cover to an app backend', async () => {
  audiusRequest.mockResolvedValueOnce({ playlist_id: 'created' });
  await expect(createOwnedPlaylist('owner', ' My mix ')).resolves.toMatchObject({ id: 'created', source: 'audius', ownerId: 'owner', title: 'My mix' });
  expect(audiusRequest).toHaveBeenCalledWith('/playlists?user_id=owner', {
    method: 'POST', body: { playlist_name: 'My mix', is_private: false, is_album: false, playlist_contents: [] },
  });
  await expect(createOwnedPlaylist('owner', 'Cover mix', 'file:///cover.jpg')).rejects.toThrow('add artwork on Audius');
});

test('history persists simultaneous plays locally, deduplicates across pages and counts completed minutes once', async () => {
  await Promise.all([
    recordListeningEvent('owner', 'play', 'one', song('one')),
    recordListeningEvent('owner', 'complete', 'one', song('one'), { playedSeconds: 180 }),
    recordListeningEvent('owner', 'play', 'two', song('two')),
    recordListeningEvent('owner', 'play', 'one', song('one')),
  ]);
  const first = await loadListeningHistoryPage('owner', null, 1);
  expect(first.items.map(({ song }) => song.id)).toEqual(['one']);
  expect(first.hasMore).toBe(true);
  const second = await loadListeningHistoryPage('owner', first.cursor, 1);
  expect(second.items.map(({ song }) => song.id)).toEqual(['two']);
  expect(second.hasMore).toBe(false);
  const stats = await loadMonthlyListeningStats('owner', { force: true });
  expect(stats).toMatchObject({ plays: 3, minutes: 3, uniqueTracks: 2, artists: 1, longestStreak: 1 });
  expect(audiusRequest).not.toHaveBeenCalled();
});

test('failed local history persistence reports an error without rejecting playback', async () => {
  const error = new Error('Storage is full');
  AsyncStorage.setItem.mockRejectedValueOnce(error);
  await expect(recordListeningEvent('owner', 'play', 'track', song('track'))).resolves.toBeUndefined();
  expect(reportError).toHaveBeenCalledWith(error, 'listening.persist');
});

test('another account cannot read cached favorites or edit this account', async () => {
  getCurrentAudiusUserId.mockReturnValue('someone-else');
  await expect(loadFavoriteSongs('owner', { offlineOnly: true })).rejects.toThrow('session has expired');
  await expect(toggleUserCollectionItem('owner', 'LikedSongs', 'track')).rejects.toThrow('session has expired');
  expect(audiusRequest).not.toHaveBeenCalled();
});

test('Home publishes tracks before slower artist discovery finishes', async () => {
  let finishArtists;
  getTopAudiusArtists.mockReturnValue(new Promise((resolve) => { finishArtists = resolve; }));
  let songs;
  let complete = false;
  const pending = loadHomeFeed('', 1_000, (value) => { songs = value; }).then((value) => { complete = true; return value; });
  for (let turn = 0; turn < 20; turn += 1) await Promise.resolve();
  expect(songs?.[0].id).toBe('recommended');
  expect(complete).toBe(false);
  finishArtists([]);
  expect((await pending).songs).toEqual(songs);
});

test('Data Saver requests smaller discovery pages and reuses recommendations without truncating the library', async () => {
  setDataSaverEnabled(true);
  getCurrentAudiusUserId.mockReturnValue('data-saver-owner');
  audiusRequest.mockImplementation(async (path) => ({
    data: path.includes('recommended-tracks')
      ? Array.from({ length: 24 }, (_, i) => ({ id: `rec-${i}`, title: 'Song', user: { id: `artist-${i}` } }))
      : [],
  }));
  const first = await loadHomeFeed('data-saver-owner', 1_000);
  const second = await loadHomeFeed('data-saver-owner', 2_000);
  expect(first.songs).toHaveLength(5);
  expect(second.songs).toHaveLength(5);
  expect(audiusRequest.mock.calls.filter(([path]) => path.includes('recommended-tracks'))).toEqual([
    ['/users/data-saver-owner/recommended-tracks?limit=24&user_id=data-saver-owner'],
  ]);
  expect(audiusRequest.mock.calls.filter(([path]) => path.includes('playlists/trending'))).toEqual([
    ['/playlists/trending?limit=6&time=week'],
  ]);
  expect(getTopAudiusArtists.mock.calls).toEqual([[12], [12]]);
  setDataSaverEnabled(false);
});


test('successive playlist edits preserve acknowledged additions while Audius indexing catches up', async () => {
  audiusRequest.mockImplementation(async (_path, options) => options?.method === 'PUT'
    ? { transaction_hash: 'accepted' }
    : { data: [playlist('queued', ['original'])] });
  await Promise.all([
    setSongInOwnedPlaylist('owner', 'queued', 'first-addition', true),
    setSongInOwnedPlaylist('owner', 'queued', 'second-addition', true),
  ]);
  const writes = audiusRequest.mock.calls.filter(([, options]) => options?.method === 'PUT');
  expect(writes).toHaveLength(2);
  expect(writes[1][1].body.playlist_contents.map(({ track_id }) => track_id)).toEqual(['original', 'first-addition', 'second-addition']);
});
