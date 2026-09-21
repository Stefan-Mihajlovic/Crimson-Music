import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAudiusDiscoveryMix, getFollowedAudiusReleases, getPersonalizedAudiusTracks, getRecommendedAudiusTracks, getTrendingAudiusTracks } from '@/services/audius';
import { getAudiusSessionRevision, getCurrentAudiusUserId } from '@/services/audius-session';
import { isAccountDeleted, registerAccountCleanup } from '@/services/account-lifecycle';
import { preferredGenres, rankDiscoveryTracks, type DiscoveryProfile } from '@/services/discovery-profile';
import { loadFavoriteSongs, loadLibraryFeed, readLocalListeningEvents } from '@/services/music';
import type { CrimsonSong } from '@/types/music';
import { requestLibraryRefresh } from '@/services/navigation-events';

export type PersonalMixId = 'daily' | 'weekly' | 'monthly' | 'release-radar' | 'rediscover' | 'hidden-gems';
export type MixPeriod = 'daily' | 'weekly' | 'monthly';
export const personalMixDefinitions: { id: PersonalMixId; title: string; description: string; period: MixPeriod; color: string; accent: string; limit: number; emptyMessage: string }[] = [
  { id: 'daily', title: 'Daily Mix', description: 'A fresh selection for your day, shaped by your taste.', period: 'daily', color: '#752539', accent: '#FFA393', limit: 25, emptyMessage: 'Listen and favorite songs to help shape your daily selection.' },
  { id: 'weekly', title: 'Weekly Mix', description: 'A week of discoveries and songs that fit your world.', period: 'weekly', color: '#39347B', accent: '#C6B2FF', limit: 35, emptyMessage: 'Your weekly selection will appear when recommendations are available.' },
  { id: 'monthly', title: 'Monthly Mix', description: 'A longer collection to spend the month with.', period: 'monthly', color: '#235C59', accent: '#91E7CE', limit: 50, emptyMessage: 'Your monthly selection will appear when recommendations are available.' },
  { id: 'release-radar', title: 'Release Radar', description: 'New tracks from artists you follow, released in the last 30 days.', period: 'weekly', color: '#855C20', accent: '#FFD491', limit: 40, emptyMessage: 'No recent releases yet. Follow artists to bring their new music here.' },
  { id: 'rediscover', title: 'Rediscover', description: 'Favorites you have not played lately, ready for another moment.', period: 'weekly', color: '#664176', accent: '#E8B2F4', limit: 30, emptyMessage: 'Favorite some songs to build your Rediscover mix.' },
  { id: 'hidden-gems', title: 'Hidden Gems', description: 'Underground discoveries matched to your music preferences.', period: 'weekly', color: '#2A527E', accent: '#9CD7FF', limit: 30, emptyMessage: 'Underground discoveries will appear when the chart is available.' },
];

export type PersonalMix = {
  id: PersonalMixId;
  owner: string;
  periodKey: string;
  createdAt: number;
  refreshAt: number;
  songs: CrimsonSong[];
  bookmarked: boolean;
  status: 'ready' | 'empty' | 'error' | 'offline';
  stale?: boolean;
};
type Options = { offlineOnly?: boolean; now?: Date };
const prefix = (uid?: string) => `crimson.personal-mixes.v1:${encodeURIComponent(uid || 'guest')}:`;
const pendingLoads = new Map<string, Promise<PersonalMix[]>>();
const bookmarkKey = (uid: string) => `crimson.personal-mix-bookmarks.v1:${encodeURIComponent(uid)}`;
const bookmarkOperations = new Map<string, Promise<unknown>>();
const writes = new Map<string, Set<Promise<void>>>();

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Local calendar boundaries, including Monday weeks and daylight-saving changes. */
export function personalMixPeriod(period: MixPeriod, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'weekly') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (period === 'monthly') start.setDate(1);
  const next = new Date(start);
  if (period === 'monthly') next.setMonth(next.getMonth() + 1);
  else next.setDate(next.getDate() + (period === 'weekly' ? 7 : 1));
  return { key: period === 'monthly' ? dayKey(start).slice(0, 7) : dayKey(start), refreshAt: next.getTime() };
}

export function personalMixDefinition(id: string | undefined) {
  return personalMixDefinitions.find((definition) => definition.id === id);
}

function accountGuard(uid?: string) {
  const revision = getAudiusSessionRevision();
  return () => (getCurrentAudiusUserId() || undefined) === uid && getAudiusSessionRevision() === revision && (!uid || !isAccountDeleted(uid));
}

function playable(value: unknown): CrimsonSong[] {
  if (!Array.isArray(value)) return [];
  return [...new Map(value.filter((song): song is CrimsonSong => Boolean(song && song.id && song.source === 'audius' && song.streamable === true && typeof song.title === 'string' && typeof song.creator === 'string' && typeof song.genre === 'string' && Array.isArray(song.tags))).map((song) => [song.id, song])).values()];
}

async function readMix(uid: string | undefined, id: PersonalMixId): Promise<PersonalMix | null> {
  try {
    const raw = await AsyncStorage.getItem(`${prefix(uid)}${id}`);
    const value = raw ? JSON.parse(raw) as PersonalMix : null;
    if (!value || value.owner !== (uid || 'guest') || value.id !== id || typeof value.periodKey !== 'string' || !Number.isFinite(value.refreshAt)) return null;
    const songs = playable(value.songs);
    // Legacy remote playlist references are intentionally ignored: a bookmark
    // always opens the current edition, never a frozen Audius playlist.
    return { id, owner: value.owner, periodKey: value.periodKey, createdAt: value.createdAt, refreshAt: value.refreshAt, songs, bookmarked: false, status: songs.length ? 'ready' : 'empty' };
  } catch { return null; }
}

async function persistMix(uid: string | undefined, mix: PersonalMix, current: () => boolean) {
  if (!current()) return;
  const { bookmarked: _bookmarked, ...edition } = mix;
  const pending = AsyncStorage.setItem(`${prefix(uid)}${mix.id}`, JSON.stringify(edition));
  const accountWrites = writes.get(uid || 'guest') || new Set<Promise<void>>();
  accountWrites.add(pending);
  writes.set(uid || 'guest', accountWrites);
  try { await pending; } finally { accountWrites.delete(pending); if (!accountWrites.size) writes.delete(uid || 'guest'); }
}

function seedNumber(text: string) {
  let value = 2166136261;
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
}

function spaceArtists(songs: CrimsonSong[], limit: number) {
  const remaining = [...songs];
  const result: CrimsonSong[] = [];
  while (remaining.length && result.length < limit) {
    const recent = new Set(result.slice(-2).map((song) => song.artistId));
    const next = remaining.findIndex((song) => !recent.has(song.artistId));
    result.push(remaining.splice(Math.max(0, next), 1)[0]);
  }
  return result;
}

async function generateMixes(uid: string | undefined, profile: DiscoveryProfile, options: Options, current: () => boolean): Promise<PersonalMix[]> {
  const now = options.now || new Date();
  const saved = await Promise.all(personalMixDefinitions.map((definition) => readMix(uid, definition.id)));
  if (!current()) return [];
  const mixes = personalMixDefinitions.map((definition, index): PersonalMix => {
    const period = personalMixPeriod(definition.period, now);
    const snapshot = saved[index];
    if (snapshot?.songs.length && (snapshot.periodKey === period.key || options.offlineOnly)) return { ...snapshot, stale: snapshot.periodKey !== period.key };
    return { id: definition.id, owner: uid || 'guest', periodKey: period.key, refreshAt: period.refreshAt, createdAt: now.getTime(), songs: [], bookmarked: false, status: options.offlineOnly ? 'offline' : 'empty' };
  });
  if (options.offlineOnly || mixes.every((mix) => mix.songs.length)) return mixes;
  const needs = new Set(mixes.filter((mix) => !mix.songs.length).map((mix) => mix.id));
  const needRecommendations = ['daily', 'weekly', 'monthly'].some((id) => needs.has(id as PersonalMixId));
  const [personalized, general, genres, underground, releases, favorites, library, history] = await Promise.allSettled([
    needRecommendations && uid ? getPersonalizedAudiusTracks(uid, 100) : Promise.resolve([]),
    needRecommendations ? getRecommendedAudiusTracks(100) : Promise.resolve([]),
    needRecommendations ? Promise.all(preferredGenres(profile).slice(0, 3).map((genre) => getTrendingAudiusTracks(40, genre).catch(() => []))).then((groups) => groups.flat()) : Promise.resolve([]),
    needs.has('hidden-gems') ? getAudiusDiscoveryMix('underground', 100) : Promise.resolve([]),
    uid && needs.has('release-radar') ? getFollowedAudiusReleases(uid, 100) : Promise.resolve([]),
    uid && needs.has('rediscover') ? loadFavoriteSongs(uid) : Promise.resolve([]),
    uid && needRecommendations ? loadLibraryFeed(uid) : Promise.resolve(null),
    uid ? readLocalListeningEvents(uid) : Promise.resolve([]),
  ]);
  if (!current()) return [];
  const tracks = (result: PromiseSettledResult<CrimsonSong[]>) => result.status === 'fulfilled' ? playable(result.value) : [];
  const events = history.status === 'fulfilled' ? history.value : [];
  const lastPlayed = new Map<string, number>();
  events.filter((event) => event.type === 'play').forEach((event) => lastPlayed.set(event.trackId, Math.max(event.occurredAt, lastPlayed.get(event.trackId) || 0)));
  const recent = new Set([...lastPlayed].filter(([, at]) => at >= now.getTime() - 7 * 86_400_000).map(([id]) => id));
  const skipped = new Set(events.filter((event) => event.type === 'skip' && event.occurredAt >= now.getTime() - 14 * 86_400_000).map((event) => event.trackId));
  const followed = new Set(library.status === 'fulfilled' ? library.value?.followedArtists.map((artist) => artist.id) : []);
  const candidates = playable([...tracks(personalized), ...tracks(general), ...tracks(genres)]);
  const recommendationFailed = (!uid || personalized.status === 'rejected') && general.status === 'rejected' && !tracks(genres).length;
  await Promise.all(mixes.map(async (mix, index) => {
    if (!needs.has(mix.id)) return;
    const definition = personalMixDefinitions[index];
    const seed = seedNumber(`${uid || 'guest'}:${mix.id}:${mix.periodKey}`);
    const rank = (songs: CrimsonSong[], rankingProfile = profile) => rankDiscoveryTracks(songs, rankingProfile, recent, skipped, followed, seed).map(({ song }) => song);
    let sourceFailed = false;
    if (mix.id === 'release-radar') {
      sourceFailed = releases.status === 'rejected';
      mix.songs = tracks(releases).filter((song) => {
        const released = Date.parse(song.releaseDate);
        return Number.isFinite(released) && released <= now.getTime() && released >= now.getTime() - 30 * 86_400_000;
      }).sort((a, b) => Date.parse(b.releaseDate) - Date.parse(a.releaseDate)).slice(0, definition.limit);
    } else if (mix.id === 'rediscover') {
      sourceFailed = favorites.status === 'rejected';
      mix.songs = rank(tracks(favorites)).sort((a, b) => (lastPlayed.get(a.id) || 0) - (lastPlayed.get(b.id) || 0)).slice(0, definition.limit);
    } else if (mix.id === 'hidden-gems') {
      sourceFailed = underground.status === 'rejected';
      mix.songs = spaceArtists(rank(tracks(underground), { ...profile, recommendationStyle: 'underground' }), definition.limit);
    } else {
      sourceFailed = recommendationFailed;
      mix.songs = spaceArtists(rank(candidates), definition.limit);
    }
    mix.status = mix.songs.length ? 'ready' : sourceFailed ? 'error' : 'empty';
    if (sourceFailed && saved[index]?.songs.length) {
      Object.assign(mix, saved[index], { stale: true });
    } else if (mix.songs.length) {
      // Never replace the rest of this period after a refresh or preference edit.
      await persistMix(uid, mix, current).catch(() => undefined);
    }
  }));
  return current() ? mixes : [];
}

export async function loadPersonalMixes(uid = getCurrentAudiusUserId() || undefined, profile: DiscoveryProfile = {}, options: Options = {}): Promise<PersonalMix[]> {
  const current = accountGuard(uid);
  if (!current()) return [];
  // Migrate local legacy likes before an expired edition can be replaced.
  try { if (uid) await readPersonalMixBookmarkIds(uid); }
  catch (error) { if (!current()) return []; throw error; }
  if (!current()) return [];
  const now = options.now || new Date();
  const key = `${prefix(uid)}${getAudiusSessionRevision()}:${dayKey(now)}:${Boolean(options.offlineOnly)}`;
  const pending = pendingLoads.get(key) || generateMixes(uid, profile, options, current);
  pendingLoads.set(key, pending);
  try {
    const generated = await pending;
    if (!current()) return [];
    const bookmarks = new Set(uid ? await readPersonalMixBookmarkIds(uid) : []);
    return current() ? generated.map((mix) => ({ ...mix, bookmarked: bookmarks.has(mix.id) })) : [];
  } catch (error) { if (!current()) return []; throw error; }
  finally { if (pendingLoads.get(key) === pending) pendingLoads.delete(key); }
}

function serializeBookmarks<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  const previous = bookmarkOperations.get(uid) || Promise.resolve();
  const pending = previous.catch(() => undefined).then(operation);
  bookmarkOperations.set(uid, pending);
  void pending.finally(() => { if (bookmarkOperations.get(uid) === pending) bookmarkOperations.delete(uid); }).catch(() => undefined);
  return pending;
}

function validBookmarkIds(value: unknown): PersonalMixId[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set(value);
  return personalMixDefinitions.filter((definition) => ids.has(definition.id)).map((definition) => definition.id);
}

async function readBookmarksUnlocked(uid: string, assertCurrent: () => void): Promise<PersonalMixId[]> {
  const raw = await AsyncStorage.getItem(bookmarkKey(uid));
  assertCurrent();
  if (raw !== null) {
    try {
      const stored = JSON.parse(raw) as { version?: number; mixIds?: unknown };
      return stored?.version === 1 ? validBookmarkIds(stored.mixIds) : [];
    } catch { return []; }
  }
  // One-time local migration preserves previous likes. It never reads, edits,
  // uploads to, or deletes the old Audius playlists that may still exist.
  const legacy = await Promise.all(personalMixDefinitions.map(async ({ id }) => {
    const edition = await AsyncStorage.getItem(`${prefix(uid)}${id}`);
    if (!edition) return null;
    try {
      const value = JSON.parse(edition) as { owner?: string; savedPlaylistId?: string };
      return value.owner === uid && typeof value.savedPlaylistId === 'string' && value.savedPlaylistId ? id : null;
    } catch { return null; }
  }));
  assertCurrent();
  const ids = validBookmarkIds(legacy);
  if (ids.length) await AsyncStorage.setItem(bookmarkKey(uid), JSON.stringify({ version: 1, mixIds: ids }));
  assertCurrent();
  return ids;
}

/** Account-scoped IDs; calendar editions and their songs are not bookmark data. */
export async function readPersonalMixBookmarkIds(uid = getCurrentAudiusUserId() || undefined): Promise<PersonalMixId[]> {
  if (!uid) return [];
  const current = accountGuard(uid);
  const assertCurrent = () => { if (!current()) throw new Error('The Audius account changed. Please try again.'); };
  assertCurrent();
  return serializeBookmarks(uid, () => readBookmarksUnlocked(uid, assertCurrent));
}

export async function setPersonalMixBookmarked(uid: string, id: PersonalMixId, bookmarked: boolean): Promise<boolean> {
  const current = accountGuard(uid);
  const assertCurrent = () => { if (!uid || !current()) throw new Error('Sign in to save mixes to your library.'); };
  assertCurrent();
  if (!personalMixDefinition(id)) throw new Error('This mix is unavailable.');
  return serializeBookmarks(uid, async () => {
    assertCurrent();
    const existing = await readBookmarksUnlocked(uid, assertCurrent);
    const ids = new Set(existing);
    if (bookmarked) ids.add(id); else ids.delete(id);
    assertCurrent();
    // Persist an empty set too, so a removed bookmark cannot be resurrected by
    // legacy local save markers on a later launch.
    await AsyncStorage.setItem(bookmarkKey(uid), JSON.stringify({ version: 1, mixIds: validBookmarkIds([...ids]) }));
    assertCurrent();
    requestLibraryRefresh();
    return bookmarked;
  });
}

export async function loadBookmarkedPersonalMixes(uid = getCurrentAudiusUserId() || undefined, profile: DiscoveryProfile = {}, options: Options = {}): Promise<PersonalMix[]> {
  if (!uid || !(await readPersonalMixBookmarkIds(uid)).length) return [];
  return (await loadPersonalMixes(uid, profile, options)).filter((mix) => mix.bookmarked);
}

registerAccountCleanup(async (uid) => {
  await bookmarkOperations.get(uid)?.catch(() => undefined);
  await Promise.allSettled([...(writes.get(uid) || [])]);
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix(uid)) || key === bookmarkKey(uid));
  if (keys.length) await AsyncStorage.multiRemove(keys);
});
