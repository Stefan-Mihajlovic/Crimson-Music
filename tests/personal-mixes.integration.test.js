import { beforeEach, expect, jest, test } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/services/audius', () => ({ getAudiusDiscoveryMix: jest.fn(), getFollowedAudiusReleases: jest.fn(), getPersonalizedAudiusTracks: jest.fn(), getRecommendedAudiusTracks: jest.fn(), getTrendingAudiusTracks: jest.fn() }));
jest.mock('../src/services/audius-session', () => ({ getCurrentAudiusUserId: jest.fn(), getAudiusSessionRevision: jest.fn() }));
jest.mock('../src/services/account-lifecycle', () => ({ isAccountDeleted: jest.fn(() => false), registerAccountCleanup: jest.fn() }));
jest.mock('../src/services/music', () => ({ createOwnedPlaylist: jest.fn(), updateOwnedPlaylist: jest.fn(), loadFavoriteSongs: jest.fn(), loadLibraryFeed: jest.fn(), readLocalListeningEvents: jest.fn() }));

let storage, audius, session, music, mixes, lifecycle;
const now = new Date(2026, 8, 15, 10);
const song = (id, extra = {}) => ({ id, source: 'audius', title: `Song ${id}`, creator: 'Artist', artistId: `artist-${id}`, artistHandle: 'artist', image: '', imageSmall: '', artwork: { small: '', medium: '', large: '', mirrors: [] }, url: '', color: '', categories: '', genre: 'Electronic', mood: 'Upbeat', tags: [], duration: 180, description: '', permalink: '', releaseDate: new Date(2026, 8, 14, 10).toISOString(), playCount: 500, favoriteCount: 10, streamable: true, downloadable: true, ...extra });
const ids = (mix) => mix.songs.map((item) => item.id);
const load = (date = now, options = {}) => mixes.loadPersonalMixes('listener', { favoriteCategories: ['electronic'] }, { now: date, ...options });
beforeEach(async () => {
  jest.resetModules();
  storage = require('@react-native-async-storage/async-storage');
  await storage.clear();
  audius = require('../src/services/audius'); session = require('../src/services/audius-session'); music = require('../src/services/music'); lifecycle = require('../src/services/account-lifecycle');
  session.getCurrentAudiusUserId.mockReturnValue('listener'); session.getAudiusSessionRevision.mockReturnValue(1);
  audius.getPersonalizedAudiusTracks.mockResolvedValue(Array.from({ length: 80 }, (_, index) => song(`personal-${index}`)));
  audius.getRecommendedAudiusTracks.mockResolvedValue([song('general')]); audius.getTrendingAudiusTracks.mockResolvedValue([song('genre')]);
  audius.getAudiusDiscoveryMix.mockResolvedValue([song('gem')]); audius.getFollowedAudiusReleases.mockResolvedValue([song('release')]);
  music.loadFavoriteSongs.mockResolvedValue([song('favorite')]); music.loadLibraryFeed.mockResolvedValue({ playlists: [], followedArtists: [{ id: 'artist-personal-1' }] }); music.readLocalListeningEvents.mockResolvedValue([]);
  music.createOwnedPlaylist.mockResolvedValue({ id: 'saved-playlist' });
  mixes = require('../src/services/personal-mixes');
});

test('calendar periods use local midnight, Monday weeks, and month rollover', () => {
  const sunday = new Date(2026, 8, 13, 23, 59);
  expect(mixes.personalMixPeriod('daily', sunday)).toEqual({ key: '2026-09-13', refreshAt: new Date(2026, 8, 14).getTime() });
  expect(mixes.personalMixPeriod('weekly', sunday)).toEqual({ key: '2026-09-07', refreshAt: new Date(2026, 8, 14).getTime() });
  expect(mixes.personalMixPeriod('weekly', new Date(2026, 8, 14))).toEqual({ key: '2026-09-14', refreshAt: new Date(2026, 8, 21).getTime() });
  expect(mixes.personalMixPeriod('monthly', new Date(2026, 11, 31))).toEqual({ key: '2026-12', refreshAt: new Date(2027, 0, 1).getTime() });
});

test('six personalized editions are playable, deduplicated, ordered, and persisted unchanged for their period', async () => {
  const original = await load();
  expect(original.map((mix) => mix.id)).toEqual(['daily', 'weekly', 'monthly', 'release-radar', 'rediscover', 'hidden-gems']);
  expect(original.map((mix) => mix.songs.length)).toEqual([25, 35, 50, 1, 1, 1]);
  expect(new Set(ids(original[0])).size).toBe(25);
  const calls = audius.getPersonalizedAudiusTracks.mock.calls.length;
  audius.getPersonalizedAudiusTracks.mockResolvedValue([song('different')]);
  const sameDay = await mixes.loadPersonalMixes('listener', { favoriteCategories: ['jazz'] }, { now });
  expect(sameDay.map(ids)).toEqual(original.map(ids));
  expect(audius.getPersonalizedAudiusTracks).toHaveBeenCalledTimes(calls);
});

test('daily refresh does not replace the weekly or monthly songs, and a new week replaces only weekly editions', async () => {
  const original = await load();
  const tomorrow = await load(new Date(2026, 8, 16, 10));
  expect(tomorrow[0].periodKey).toBe('2026-09-16');
  expect(ids(tomorrow[0])).not.toEqual(ids(original[0]));
  expect(tomorrow.slice(1).map(ids)).toEqual(original.slice(1).map(ids));
  audius.getAudiusDiscoveryMix.mockResolvedValue([song('next-gem')]);
  const nextWeek = await load(new Date(2026, 8, 21, 10));
  expect(nextWeek[1].periodKey).toBe('2026-09-21');
  expect(ids(nextWeek[1])).not.toEqual(ids(original[1]));
  expect(ids(nextWeek[2])).toEqual(ids(original[2]));
  expect(ids(nextWeek[5])).toEqual(['next-gem']);
});

test('release radar keeps recent followed originals and Rediscover ranks least-recent favorites first', async () => {
  audius.getFollowedAudiusReleases.mockResolvedValue([song('old', { releaseDate: '2025-01-01' }), song('future', { releaseDate: '2027-01-01' }), song('release'), song('release')]);
  music.loadFavoriteSongs.mockResolvedValue([song('today'), song('unheard'), song('long-ago')]);
  music.readLocalListeningEvents.mockResolvedValue([{ type: 'play', trackId: 'today', occurredAt: now.getTime() }, { type: 'play', trackId: 'long-ago', occurredAt: new Date(2025, 1, 1).getTime() }]);
  const result = await load();
  expect(ids(result[3])).toEqual(['release']);
  expect(ids(result[4])).toEqual(['unheard', 'long-ago', 'today']);
});

test('offline loads account snapshots, marks expired editions, and never requests the network', async () => {
  const original = await load();
  Object.values(audius).forEach((fn) => fn.mockClear());
  const offline = await load(new Date(2026, 9, 1), { offlineOnly: true });
  expect(offline.map(ids)).toEqual(original.map(ids));
  expect(offline.every((mix) => mix.stale)).toBe(true);
  Object.values(audius).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  session.getCurrentAudiusUserId.mockReturnValue('other');
  const other = await mixes.loadPersonalMixes('other', {}, { offlineOnly: true, now });
  expect(other.every((mix) => !mix.songs.length && mix.status === 'offline')).toBe(true);
});

test.each(['switch', 'reconnect', 'delete'])('a %s while loading discards the result without writing another account snapshot', async (change) => {
  let finish;
  audius.getPersonalizedAudiusTracks.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const loading = load();
  for (let tick = 0; tick < 60 && !finish; tick += 1) await Promise.resolve();
  if (change === 'switch') session.getCurrentAudiusUserId.mockReturnValue('other');
  if (change === 'reconnect') session.getAudiusSessionRevision.mockReturnValue(2);
  if (change === 'delete') lifecycle.isAccountDeleted.mockReturnValue(true);
  finish([song('late')]);
  await expect(loading).resolves.toEqual([]);
  expect(storage.setItem).not.toHaveBeenCalled();
});

test('transient failures preserve prior editions; first-time failures are distinct from genuinely empty mixes', async () => {
  const original = await load();
  audius.getPersonalizedAudiusTracks.mockRejectedValue(new Error('offline')); audius.getRecommendedAudiusTracks.mockRejectedValue(new Error('offline')); audius.getTrendingAudiusTracks.mockRejectedValue(new Error('offline'));
  audius.getFollowedAudiusReleases.mockRejectedValue(new Error('offline'));
  const stale = await load(new Date(2026, 9, 1));
  expect(ids(stale[0])).toEqual(ids(original[0]));
  expect(stale[0].stale).toBe(true);
  await storage.clear();
  const empty = await load();
  expect(empty[0].status).toBe('error'); expect(empty[3].status).toBe('error');
  expect(empty[4].status).toBe('ready');
});

test('account cleanup deletes only its own mixes', async () => {
  await load();
  session.getCurrentAudiusUserId.mockReturnValue('other');
  await mixes.loadPersonalMixes('other', {}, { now });
  await lifecycle.registerAccountCleanup.mock.calls[0][0]('listener');
  expect((await storage.getAllKeys()).some((key) => key.includes(':listener:'))).toBe(false);
  expect((await storage.getAllKeys()).some((key) => key.includes(':other:'))).toBe(true);
});


test('liking persists only live mix IDs, deduplicates concurrent writes, and performs no remote writes', async () => {
  await Promise.all([mixes.setPersonalMixBookmarked('listener', 'daily', true), mixes.setPersonalMixBookmarked('listener', 'daily', true), mixes.setPersonalMixBookmarked('listener', 'weekly', true)]);
  expect(await mixes.readPersonalMixBookmarkIds('listener')).toEqual(['daily', 'weekly']);
  const key = (await storage.getAllKeys()).find((key) => key.startsWith('crimson.personal-mix-bookmarks'));
  expect(JSON.parse(await storage.getItem(key))).toEqual({ version: 1, mixIds: ['daily', 'weekly'] });
  expect(await storage.getAllKeys()).toEqual([key]);
  Object.values(audius).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  Object.values(music).forEach((fn) => expect(fn).not.toHaveBeenCalled());
});

test('bookmarks survive restart from stored IDs and resolve the current day, week, and month', async () => {
  await Promise.all(['daily', 'weekly', 'monthly'].map((id) => mixes.setPersonalMixBookmarked('listener', id, true)));
  const key = 'crimson.personal-mix-bookmarks.v1:listener';
  const persisted = await storage.getItem(key);
  jest.resetModules();
  const restartedStorage = require('@react-native-async-storage/async-storage');
  await restartedStorage.setItem(key, persisted);
  const restartedSession = require('../src/services/audius-session');
  restartedSession.getCurrentAudiusUserId.mockReturnValue('listener'); restartedSession.getAudiusSessionRevision.mockReturnValue(1);
  const restartedAudius = require('../src/services/audius');
  Object.values(restartedAudius).forEach((fn) => fn.mockResolvedValue(Array.from({ length: 60 }, (_, index) => song(`new-${index}`))));
  const restartedMusic = require('../src/services/music');
  restartedMusic.loadLibraryFeed.mockResolvedValue({ playlists: [], followedArtists: [] }); restartedMusic.readLocalListeningEvents.mockResolvedValue([]); restartedMusic.loadFavoriteSongs.mockResolvedValue([]);
  const restartedMixes = require('../src/services/personal-mixes');
  expect(await restartedMixes.readPersonalMixBookmarkIds('listener')).toEqual(['daily', 'weekly', 'monthly']);
  const current = await restartedMixes.loadBookmarkedPersonalMixes('listener', {}, { now: new Date(2026, 9, 5, 10) });
  expect(current.map((mix) => [mix.id, mix.periodKey, mix.bookmarked])).toEqual([['daily', '2026-10-05', true], ['weekly', '2026-10-05', true], ['monthly', '2026-10', true]]);
  expect(restartedMusic.createOwnedPlaylist).not.toHaveBeenCalled();
  expect(restartedMusic.updateOwnedPlaylist).not.toHaveBeenCalled();
});

test('unbookmarking remains removed after reload and bookmarks work offline without any songs yet', async () => {
  await mixes.setPersonalMixBookmarked('listener', 'daily', true);
  let library = await mixes.loadBookmarkedPersonalMixes('listener', {}, { offlineOnly: true, now });
  expect(library).toHaveLength(1);
  expect(library[0]).toMatchObject({ id: 'daily', bookmarked: true, status: 'offline', songs: [] });
  await mixes.setPersonalMixBookmarked('listener', 'daily', false);
  expect(await mixes.readPersonalMixBookmarkIds('listener')).toEqual([]);
  library = await mixes.loadBookmarkedPersonalMixes('listener', {}, { offlineOnly: true, now });
  expect(library).toEqual([]);
  Object.values(music).forEach((fn) => expect(fn).not.toHaveBeenCalled());
});

test('account bookmarks are isolated and clearing one account preserves the other', async () => {
  await mixes.setPersonalMixBookmarked('listener', 'weekly', true);
  session.getCurrentAudiusUserId.mockReturnValue('other');
  await mixes.setPersonalMixBookmarked('other', 'monthly', true);
  expect(await mixes.readPersonalMixBookmarkIds('other')).toEqual(['monthly']);
  await expect(mixes.readPersonalMixBookmarkIds('listener')).rejects.toThrow('account changed');
  await lifecycle.registerAccountCleanup.mock.calls[0][0]('listener');
  expect(await mixes.readPersonalMixBookmarkIds('other')).toEqual(['monthly']);
  expect((await storage.getAllKeys()).some((key) => key.endsWith(':listener'))).toBe(false);
});

test('local legacy likes migrate to bookmarks before rollover without reading or editing old remote playlists', async () => {
  await storage.setItem('crimson.personal-mixes.v1:listener:daily', JSON.stringify({ ...((await load())[0]), savedPlaylistId: 'existing-remote-playlist', savedArtworkVersion: 2 }));
  Object.values(music).forEach((fn) => fn.mockClear());
  expect(await mixes.readPersonalMixBookmarkIds('listener')).toEqual(['daily']);
  Object.values(music).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  const current = await mixes.loadBookmarkedPersonalMixes('listener', {}, { now: new Date(2026, 8, 16, 10) });
  expect(current[0]).toMatchObject({ id: 'daily', periodKey: '2026-09-16', bookmarked: true });
  expect(current[0].savedPlaylistId).toBeUndefined();
  expect(music.createOwnedPlaylist).not.toHaveBeenCalled();
  expect(music.updateOwnedPlaylist).not.toHaveBeenCalled();
  await mixes.setPersonalMixBookmarked('listener', 'daily', false);
  expect(await mixes.readPersonalMixBookmarkIds('listener')).toEqual([]);
});

test('account changes while a bookmark is waiting on storage reject without writing the new account', async () => {
  let finish;
  storage.getItem.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const pending = mixes.setPersonalMixBookmarked('listener', 'daily', true);
  for (let tick = 0; tick < 20 && !finish; tick += 1) await Promise.resolve();
  session.getCurrentAudiusUserId.mockReturnValue('other');
  finish(null);
  await expect(pending).rejects.toThrow('Sign in');
  expect(storage.setItem).not.toHaveBeenCalled();
});

test('opening Home after a calendar rollover migrates legacy likes before replacing the cached edition', async () => {
  const original = (await load())[0];
  await storage.setItem('crimson.personal-mixes.v1:listener:daily', JSON.stringify({ ...original, savedPlaylistId: 'old-remote-playlist' }));
  const current = await load(new Date(2026, 9, 1, 10));
  expect(current[0]).toMatchObject({ id: 'daily', periodKey: '2026-10-01', bookmarked: true });
  expect(await mixes.readPersonalMixBookmarkIds('listener')).toEqual(['daily']);
  expect(JSON.parse(await storage.getItem('crimson.personal-mixes.v1:listener:daily')).savedPlaylistId).toBeUndefined();
  expect(music.createOwnedPlaylist).not.toHaveBeenCalled();
  expect(music.updateOwnedPlaylist).not.toHaveBeenCalled();
});
