import AsyncStorage from '@react-native-async-storage/async-storage';

import { isAccountDeleted, registerAccountCleanup } from '@/services/account-lifecycle';
import { getAudiusArtistTracksPage, getAudiusDiscoveryMix } from '@/services/audius';
import { getAudiusSessionRevision, getCurrentAudiusUserId } from '@/services/audius-session';
import { getDataSaverEnabled } from '@/services/data-usage';
import { preferredGenres, rankDiscoveryTracks, type DiscoveryProfile } from '@/services/discovery-profile';
import type { CrimsonSong } from '@/types/music';

export type HomeDiscovery = { underground: CrimsonSong[] };
type LoadOptions = { offlineOnly?: boolean };
const emptyDiscovery = (): HomeDiscovery => ({ underground: [] });
const accountPrefix = (uid?: string) => `crimson.home.discovery.v1:${encodeURIComponent(uid || 'guest')}:`;
const pendingWrites = new Map<string, Set<Promise<void>>>();

registerAccountCleanup(async (uid) => {
  await Promise.allSettled([...(pendingWrites.get(uid) || [])]);
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(accountPrefix(uid)));
  if (keys.length) await AsyncStorage.multiRemove(keys);
});

function currentAccountGuard(uid?: string) {
  const revision = getAudiusSessionRevision();
  return () => (getCurrentAudiusUserId() || undefined) === uid
    && getAudiusSessionRevision() === revision && (!uid || !isAccountDeleted(uid));
}

function playableSongs(value: unknown): CrimsonSong[] {
  if (!Array.isArray(value)) return [];
  const songs = value.filter((song): song is CrimsonSong => Boolean(
    song && typeof song === 'object' && typeof song.id === 'string' && song.id
    && song.source === 'audius' && song.streamable === true
    && typeof song.title === 'string' && typeof song.creator === 'string'
    && typeof song.artistId === 'string' && typeof song.genre === 'string'
    && Array.isArray(song.tags),
  ));
  return [...new Map(songs.map((song) => [song.id, song])).values()];
}

async function readSnapshot(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function writeSnapshot(key: string, uid: string | undefined, value: unknown, isCurrent: () => boolean) {
  if (!isCurrent()) return;
  const pending = AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => undefined);
  const writes = pendingWrites.get(uid || 'guest') || new Set<Promise<void>>();
  writes.add(pending);
  pendingWrites.set(uid || 'guest', writes);
  try { await pending; } finally {
    writes.delete(pending);
    if (!writes.size) pendingWrites.delete(uid || 'guest');
  }
}

function savedDiscovery(value: unknown): HomeDiscovery {
  if (!value || typeof value !== 'object') return emptyDiscovery();
  const saved = value as Partial<HomeDiscovery>;
  return { underground: playableSongs(saved.underground) };
}

/** Independent of the main feed; Audius caches this chart for five minutes per account. */
export async function loadHomeDiscovery(
  uid = getCurrentAudiusUserId() || undefined,
  profile: DiscoveryProfile = {},
  rotation = Date.now(),
  { offlineOnly = false }: LoadOptions = {},
): Promise<HomeDiscovery> {
  const isCurrent = currentAccountGuard(uid);
  if (!isCurrent()) return emptyDiscovery();
  const limit = getDataSaverEnabled() ? 6 : 12;
  const profileKey = encodeURIComponent(JSON.stringify([preferredGenres(profile).sort(), profile.recommendationStyle || 'balanced']));
  const key = `${accountPrefix(uid)}charts:${limit}:${profileKey}`;
  if (offlineOnly) {
    const saved = savedDiscovery(await readSnapshot(key));
    return isCurrent() ? saved : emptyDiscovery();
  }

  try {
    const songs = await getAudiusDiscoveryMix('underground', limit);
    if (!isCurrent()) return emptyDiscovery();
    const discovery: HomeDiscovery = {
      underground: rankDiscoveryTracks(playableSongs(songs), profile, new Set(), new Set(), new Set(), rotation)
        .map(({ song }) => song).slice(0, limit),
    };
    await writeSnapshot(key, uid, discovery, isCurrent);
    return isCurrent() ? discovery : emptyDiscovery();
  } catch {
    const saved = savedDiscovery(await readSnapshot(key));
    return isCurrent() ? saved : emptyDiscovery();
  }
}

/** Most-played tracks for the spotlight, without fetching the full artist page. */
export async function loadHomeSpotlightTracks(
  artistId: string,
  uid = getCurrentAudiusUserId() || undefined,
  { offlineOnly = false }: LoadOptions = {},
): Promise<CrimsonSong[]> {
  const isCurrent = currentAccountGuard(uid);
  if (!artistId || !isCurrent()) return [];
  const key = `${accountPrefix(uid)}spotlight:${encodeURIComponent(artistId)}`;
  const savedTracks = async () => playableSongs(await readSnapshot(key)).filter((song) => song.artistId === artistId).slice(0, 6);
  if (offlineOnly) {
    const songs = await savedTracks();
    return isCurrent() ? songs : [];
  }
  try {
    const page = await getAudiusArtistTracksPage(artistId, 6, 0, 'plays');
    if (!isCurrent()) return [];
    const songs = playableSongs(page.items).filter((song) => song.artistId === artistId).slice(0, 6);
    await writeSnapshot(key, uid, songs, isCurrent);
    return isCurrent() ? songs : [];
  } catch {
    const songs = await savedTracks();
    return isCurrent() ? songs : [];
  }
}
