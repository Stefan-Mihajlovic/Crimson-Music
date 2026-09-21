import { beforeEach, expect, jest, test } from '@jest/globals';
import { searchAudiusPage, getFollowedAudiusReleases, clearAudiusCaches } from '../src/services/audius';
import { audiusFetch } from '../src/services/audius-session';
import { hasSearchFilters, normalizeSearchFilters, searchFilterParams } from '../src/services/search-filters';

jest.mock('../src/services/audius-session', () => ({ audiusFetch: jest.fn(), getCurrentAudiusUserId: () => 'listener' }));
beforeEach(() => { clearAudiusCaches(); audiusFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) }); });

test('filter mapping uses the documented Audius REST names and preserves upper/lower BPM bounds', () => {
  expect(searchFilterParams({ genre: 'House', mood: 'Upbeat', musicalKey: 'Am', bpmMin: 110, bpmMax: 130, downloadableOnly: true })).toEqual({ genre: 'House', mood: 'Upbeat', key: 'Am', bpm_min: 110, bpm_max: 130, only_downloadable: true });
  expect(normalizeSearchFilters({ genre: 'invented', musicalKey: 'invalid', bpmMin: NaN, bpmMax: 0, downloadableOnly: false })).toEqual({});
  expect(() => normalizeSearchFilters({ bpmMin: 150, bpmMax: 90 })).toThrow('Minimum BPM');
  expect(hasSearchFilters({ bpmMin: 120 })).toBe(true);
});

test('filters browse songs without a query, and paging keeps all server filters', async () => {
  const filters = { genre: 'House', mood: 'Upbeat', musicalKey: 'Am', bpmMin: 110, bpmMax: 130, downloadableOnly: true };
  await searchAudiusPage('', 'songs', 30, 30, filters);
  const url = new URL(audiusFetch.mock.calls[0][0], 'https://api.audius.co');
  expect(url.pathname).toBe('/tracks/search');
  expect(Object.fromEntries(url.searchParams)).toEqual({ offset: '30', limit: '30', sort_method: 'relevant', genre: 'House', mood: 'Upbeat', key: 'Am', bpm_min: '110', bpm_max: '130', only_downloadable: 'true' });
});

test('unfiltered short queries still do not request the API, and track filters never leak to artist search', async () => {
  expect(await searchAudiusPage('', 'songs')).toEqual({ items: [], nextOffset: 0, hasMore: false });
  expect(await searchAudiusPage('a', 'artists', 0, 30, { genre: 'House' })).toEqual({ items: [], nextOffset: 0, hasMore: false });
  expect(audiusFetch).not.toHaveBeenCalled();
  await searchAudiusPage('test', 'artists', 0, 30, { genre: 'House' });
  expect(audiusFetch.mock.calls[0][0]).not.toContain('genre');
});

test('filtered pages remove nonstreamable results but advance by the raw page size', async () => {
  audiusFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [{ id: 'one', title: 'First', user: { id: 'artist' } }, { id: 'locked', is_streamable: false }] }) });
  const result = await searchAudiusPage('', 'songs', 10, 2, { genre: 'House' });
  expect(result.items.map((song) => song.id)).toEqual(['one']); expect(result.nextOffset).toBe(12); expect(result.hasMore).toBe(true);
});

test('Release Radar fetches followed original tracks, excluding repost and playlist activity', async () => {
  audiusFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [{ type: 'track', item: { id: 'new', title: 'Release', user: { id: 'artist' } } }, { type: 'playlist', item: { id: 'playlist' } }] }) });
  const result = await getFollowedAudiusReleases('listener', 100);
  expect(audiusFetch.mock.calls[0][0]).toContain('/users/listener/feed?');
  const url = new URL(audiusFetch.mock.calls[0][0], 'https://api.audius.co');
  expect(url.searchParams.get('filter')).toBe('original'); expect(url.searchParams.get('tracks_only')).toBe('true');
  expect(result.map((song) => song.id)).toEqual(['new']);
});
