import { beforeEach, expect, jest, test } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/services/audius', () => ({ getAudiusDiscoveryMix: jest.fn(), getAudiusArtistTracksPage: jest.fn() }));
jest.mock('../src/services/audius-session', () => ({ getCurrentAudiusUserId: jest.fn(), getAudiusSessionRevision: jest.fn() }));
jest.mock('../src/services/data-usage', () => ({ getDataSaverEnabled: jest.fn(() => false) }));
jest.mock('../src/services/account-lifecycle', () => ({ isAccountDeleted: jest.fn(() => false), registerAccountCleanup: jest.fn() }));

let storage;
let audius;
let session;
let usage;
let lifecycle;
let discovery;
const song = (id, overrides = {}) => ({
  id, source: 'audius', title: `Track ${id}`, creator: 'Artist', artistId: 'artist', artistHandle: 'artist',
  image: '', imageSmall: '', artwork: { small: '', medium: '', large: '', mirrors: [] },
  url: '', duration: 180, streamable: true, downloadable: true, tags: [], genre: 'Electronic', mood: '',
  categories: '', color: '', description: '', permalink: '', releaseDate: '', playCount: 100, favoriteCount: 5,
  ...overrides,
});

beforeEach(async () => {
  jest.resetModules();
  storage = require('@react-native-async-storage/async-storage');
  await storage.clear();
  audius = require('../src/services/audius');
  session = require('../src/services/audius-session');
  usage = require('../src/services/data-usage');
  lifecycle = require('../src/services/account-lifecycle');
  session.getCurrentAudiusUserId.mockReturnValue('listener');
  session.getAudiusSessionRevision.mockReturnValue(1);
  audius.getAudiusDiscoveryMix.mockImplementation(async (kind) => [song(kind)]);
  audius.getAudiusArtistTracksPage.mockResolvedValue({ items: [song('top')], nextOffset: 1, hasMore: false });
  discovery = require('../src/services/home-discovery');
});

test('Home discovery requests only the real underground chart and persists only that section', async () => {
  const result = await discovery.loadHomeDiscovery('listener', {}, 10);
  expect(audius.getAudiusDiscoveryMix.mock.calls).toEqual([['underground', 12]]);
  expect(result.underground.map((track) => track.id)).toEqual(['underground']);
  expect(Object.keys(result)).toEqual(['underground']);
  expect(Object.keys(JSON.parse(storage.setItem.mock.calls[0][1]))).toEqual(['underground']);
  expect(audius.getAudiusArtistTracksPage).not.toHaveBeenCalled();
});

test('data saver requests and returns smaller chart collections', async () => {
  usage.getDataSaverEnabled.mockReturnValue(true);
  audius.getAudiusDiscoveryMix.mockResolvedValue(Array.from({ length: 12 }, (_, i) => song(String(i))));
  const result = await discovery.loadHomeDiscovery();
  expect(audius.getAudiusDiscoveryMix.mock.calls).toEqual([['underground', 6]]);
  expect(result.underground).toHaveLength(6);
});

test('genre preferences still rank underground candidates', async () => {
  const electronic = song('electronic');
  const pop = song('pop', { genre: 'Pop' });
  audius.getAudiusDiscoveryMix.mockResolvedValue([electronic, pop]);
  const result = await discovery.loadHomeDiscovery('listener', { favoriteCategories: ['pop'] }, 12);
  expect(result.underground.map((track) => track.id)).toEqual(['pop', 'electronic']);
});

test('duplicates and unplayable or malformed candidates cannot enter the underground section', async () => {
  audius.getAudiusDiscoveryMix.mockResolvedValue([
    song('first'), song('first'), song('blocked', { streamable: false }),
    song('', {}), song('non-audius', { source: 'other' }), null, {}, song('second'),
  ]);
  const result = await discovery.loadHomeDiscovery();
  expect(new Set(result.underground.map((track) => track.id))).toEqual(new Set(['first', 'second']));
});

test('offline-only loads the saved account snapshot without requesting the chart', async () => {
  const original = await discovery.loadHomeDiscovery('listener', {}, 10);
  audius.getAudiusDiscoveryMix.mockClear();
  await expect(discovery.loadHomeDiscovery('listener', {}, 20, { offlineOnly: true })).resolves.toEqual(original);
  expect(audius.getAudiusDiscoveryMix).not.toHaveBeenCalled();
});

test('an underground chart failure preserves its saved section', async () => {
  await discovery.loadHomeDiscovery('listener', {}, 10);
  audius.getAudiusDiscoveryMix.mockRejectedValue(new Error('Unavailable'));
  const result = await discovery.loadHomeDiscovery('listener', {}, 10);
  expect(result.underground.map((track) => track.id)).toEqual(['underground']);
});

test('old cached snapshots can retain most-shared data without exposing it in Home discovery', async () => {
  const original = await discovery.loadHomeDiscovery('listener', {}, 10);
  const key = storage.setItem.mock.calls[0][0];
  await storage.setItem(key, JSON.stringify({ ...original, mostShared: [song('old-shared')] }));
  await expect(discovery.loadHomeDiscovery('listener', {}, 10, { offlineOnly: true })).resolves.toEqual(original);
  audius.getAudiusDiscoveryMix.mockRejectedValue(new Error('Offline'));
  await expect(discovery.loadHomeDiscovery('listener', {}, 10)).resolves.toEqual(original);
});

test('chart failures without a saved snapshot produce empty optional sections', async () => {
  audius.getAudiusDiscoveryMix.mockRejectedValue(new Error('Offline'));
  await expect(discovery.loadHomeDiscovery()).resolves.toEqual({ underground: [] });
});

test('saved sections cannot cross account, preference, or data-saver boundaries', async () => {
  await discovery.loadHomeDiscovery('listener', { favoriteCategories: ['pop'] });
  const empty = { underground: [] };
  await expect(discovery.loadHomeDiscovery('listener', { favoriteCategories: ['jazz'] }, 0, { offlineOnly: true })).resolves.toEqual(empty);
  usage.getDataSaverEnabled.mockReturnValue(true);
  await expect(discovery.loadHomeDiscovery('listener', { favoriteCategories: ['pop'] }, 0, { offlineOnly: true })).resolves.toEqual(empty);
  usage.getDataSaverEnabled.mockReturnValue(false);
  session.getCurrentAudiusUserId.mockReturnValue('other');
  await expect(discovery.loadHomeDiscovery('other', { favoriteCategories: ['pop'] }, 0, { offlineOnly: true })).resolves.toEqual(empty);
});

test.each(['switch', 'reconnect', 'delete'])('%s while charts load discards the late result and prevents persistence', async (change) => {
  let finish;
  const pending = new Promise((resolve) => { finish = resolve; });
  audius.getAudiusDiscoveryMix.mockReturnValue(pending);
  const loading = discovery.loadHomeDiscovery();
  if (change === 'switch') session.getCurrentAudiusUserId.mockReturnValue('other');
  if (change === 'reconnect') session.getAudiusSessionRevision.mockReturnValue(2);
  if (change === 'delete') lifecycle.isAccountDeleted.mockReturnValue(true);
  finish([song('late')]);
  await expect(loading).resolves.toEqual({ underground: [] });
  expect(storage.setItem).not.toHaveBeenCalled();
});

test('spotlight fetches most-played tracks instead of the default latest releases', async () => {
  audius.getAudiusArtistTracksPage.mockResolvedValue({ items: [song('top'), song('second'), song('blocked', { streamable: false }), song('other-artist', { artistId: 'someone' })] });
  const result = await discovery.loadHomeSpotlightTracks('artist', 'listener');
  expect(audius.getAudiusArtistTracksPage).toHaveBeenCalledWith('artist', 6, 0, 'plays');
  expect(result.map((track) => track.id)).toEqual(['top', 'second']);
  expect(audius.getAudiusDiscoveryMix).not.toHaveBeenCalled();
});

test('spotlight has an account-scoped offline snapshot and survives a failed refresh', async () => {
  const original = await discovery.loadHomeSpotlightTracks('artist', 'listener');
  audius.getAudiusArtistTracksPage.mockClear();
  await expect(discovery.loadHomeSpotlightTracks('artist', 'listener', { offlineOnly: true })).resolves.toEqual(original);
  expect(audius.getAudiusArtistTracksPage).not.toHaveBeenCalled();
  audius.getAudiusArtistTracksPage.mockRejectedValue(new Error('Offline'));
  await expect(discovery.loadHomeSpotlightTracks('artist', 'listener')).resolves.toEqual(original);
  session.getCurrentAudiusUserId.mockReturnValue('other');
  await expect(discovery.loadHomeSpotlightTracks('artist', 'other', { offlineOnly: true })).resolves.toEqual([]);
});

test('account cleanup removes its chart and spotlight snapshots while retaining other accounts', async () => {
  await discovery.loadHomeDiscovery('listener');
  await discovery.loadHomeSpotlightTracks('artist', 'listener');
  session.getCurrentAudiusUserId.mockReturnValue('other');
  await discovery.loadHomeDiscovery('other');
  const cleanup = lifecycle.registerAccountCleanup.mock.calls[0][0];
  await cleanup('listener');
  const keys = await storage.getAllKeys();
  expect(keys.some((key) => key.includes(':listener:'))).toBe(false);
  expect(keys.some((key) => key.includes(':other:'))).toBe(true);
});

test('an explicit stale account is rejected without network or storage reads', async () => {
  await expect(discovery.loadHomeDiscovery('old')).resolves.toEqual({ underground: [] });
  await expect(discovery.loadHomeSpotlightTracks('artist', 'old')).resolves.toEqual([]);
  expect(audius.getAudiusDiscoveryMix).not.toHaveBeenCalled();
  expect(audius.getAudiusArtistTracksPage).not.toHaveBeenCalled();
  expect(storage.getItem).not.toHaveBeenCalled();
});
