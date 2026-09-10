import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAccountDeleted, registerAccountCleanup } from '@/services/account-lifecycle';
import { reportError } from '@/services/telemetry';
import { audiusRequest, getCurrentAudiusUserId } from '@/services/audius-session';
import { discoveryRequestLimits } from '@/services/data-usage';
import { RequestCache } from '@/services/request-cache';

import {
  getAudiusArtist,
  getAudiusArtistTracks,
  getAudiusRelatedArtists,
  getAudiusEvent,
  getAudiusEvents,
  getAudiusGenreCatalog,
  getAudiusPlaylistTracks,
  getRecommendedAudiusTracks,
  getTopAudiusArtists,
  getAudiusTrack,
  getTrendingAudiusTracks,
  resolveAudiusStreamUrl,
  searchAudius,
  mapAudiusArtist,
  mapAudiusPlaylist,
  mapAudiusTrack,
  clearAudiusCaches,
} from '@/services/audius';
import { KaraokeLine } from '@/services/karaoke';
import {
  ArtistDetail,
  CategoryDetail,
  CrimsonArtist,
  CrimsonCategory,
  CrimsonPlaylist,
  CrimsonSong,
  DiscoveryCatalog,
  LibraryFeed,
  MusicCatalog,
  PlaylistDetail,
  RelatedSong,
} from '@/types/music';

export type {
  ArtistDetail,
  CategoryDetail,
  CrimsonArtist,
  CrimsonCategory,
  CrimsonEvent,
  CrimsonPlaylist,
  CrimsonProfile,
  CrimsonSong,
  DiscoveryCatalog,
  LibraryFeed,
  MusicCatalog,
  PlaylistDetail,
  RelatedSong,
} from '@/types/music';

export type PlayerLyrics = { lyrics: string[]; karaoke: KaraokeLine[] };
export type PlayerExtras = PlayerLyrics & { related: RelatedSong[] };
export type CrimsonCollectionField = 'LikedSongs' | 'FollowedArtists' | 'LikedPlaylists';
export type ListeningEventType = 'play' | 'complete' | 'skip' | 'like' | 'unlike' | 'playlistAdd' | 'playlistRemove' | 'searchClick';
export type ListeningHistoryCursor = {
  event: string;
  seenTrackIds: string[];
};
export type ListeningHistoryEntry = {
  id: string;
  playedAt: Date;
  song: CrimsonSong;
};
export type ListeningHistoryPage = {
  cursor: ListeningHistoryCursor | null;
  hasMore: boolean;
  items: ListeningHistoryEntry[];
};
export type ProfileListeningStats = {
  artists: number;
  listeningDaysOfMonth?: number[];
  listeningDays: number;
  longestStreak: number;
  minutes: number;
  plays: number;
  topArtist: string;
  topArtistPlays: number;
  topArtists?: MonthlyTopArtist[];
  topTracks?: MonthlyTopTrack[];
  uniqueTracks: number;
};
export type MonthlyTopTrack = {
  artistId: string;
  creator: string;
  id: string;
  image: string;
  imageSmall: string;
  plays: number;
  title: string;
};
export type MonthlyTopArtist = {
  id: string;
  image: string;
  imageSmall: string;
  name: string;
  plays: number;
  songs: MonthlyTopTrack[];
};

const listeningStatsCache = new Map<string, {
  expiresAt: number;
  value: ProfileListeningStats;
}>();
const listeningStatsRequests = new Map<string, Promise<ProfileListeningStats>>();
registerAccountCleanup((uid) => {
  for (const key of listeningStatsCache.keys()) if (key.startsWith(`${uid}:`)) listeningStatsCache.delete(key);
  for (const key of listeningStatsRequests.keys()) if (key.startsWith(`${uid}:`)) listeningStatsRequests.delete(key);
});
export type VaultMood = 'Chill' | 'Focus' | 'Melancholy' | 'Motivation' | 'Party' | 'Romantic';

const offlineDataKey = (scope: string) => `crimson.offline.data.v2:${scope}`;

export async function readOfflineData<T>(scope: string): Promise<T | null> {
  try {
    const stored = await AsyncStorage.getItem(offlineDataKey(scope));
    return stored ? JSON.parse(stored) as T : null;
  } catch {
    return null;
  }
}

async function saveOfflineData(scope: string, value: unknown) {
  const uid = scope.split(':')[1];
  if (uid && isAccountDeleted(uid)) return;
  await AsyncStorage.setItem(offlineDataKey(scope), JSON.stringify(value));
}

const categories: CrimsonCategory[] = [
  { id: 'electronic', name: 'Electronic', color: '#5632A8', image: '', imageSmall: '', localImage: require('@/assets/images/categories/electronic.jpg') },
  { id: 'hip-hop-rap', name: 'Hip-Hop/Rap', color: '#8B2F52', image: '', imageSmall: '', localImage: require('@/assets/images/categories/hip-hop-rap.jpg') },
  { id: 'pop', name: 'Pop', color: '#B54778', image: '', imageSmall: '', localImage: require('@/assets/images/categories/pop.jpg') },
  { id: 'r-b-soul', name: 'R&B/Soul', color: '#7046A0', image: '', imageSmall: '', localImage: require('@/assets/images/categories/r-b-soul.jpg') },
  { id: 'rock', name: 'Rock', color: '#8C3B35', image: '', imageSmall: '', localImage: require('@/assets/images/categories/rock.jpg') },
  { id: 'ambient', name: 'Ambient', color: '#326E78', image: '', imageSmall: '', localImage: require('@/assets/images/categories/ambient.jpg') },
  { id: 'jazz', name: 'Jazz', color: '#7B5931', image: '', imageSmall: '', localImage: require('@/assets/images/categories/jazz.jpg') },
  { id: 'classical', name: 'Classical', color: '#405F8E', image: '', imageSmall: '', localImage: require('@/assets/images/categories/classical.jpg') },
  { id: 'reggae', name: 'Reggae', color: '#357650', image: '', imageSmall: '', localImage: require('@/assets/images/categories/reggae.jpg') },
  { id: 'podcasts', name: 'Podcasts', color: '#5C526B', image: '', imageSmall: '', localImage: require('@/assets/images/categories/podcasts.jpg') },
  { id: 'events', name: 'Events', color: '#70377E', image: '', imageSmall: '', localImage: require('@/assets/images/categories/events.jpg') },
];

const homeArtistGenres = ['Rock', 'Hip-Hop/Rap', 'R&B/Soul', 'Electronic', 'Pop', 'Jazz'];
const vaultMoodProfiles: Record<VaultMood, { genres: string[]; moods: string[]; tags: string[] }> = {
  Chill: {
    genres: ['Ambient', 'Lo-Fi', 'Downtempo', 'Jazz', 'R&B/Soul'],
    moods: ['chill', 'peaceful', 'relaxing', 'easygoing', 'mellow', 'gentle', 'dreamy', 'calm', 'cool', 'tender'],
    tags: ['chill', 'relax', 'lofi', 'lo-fi', 'downtempo', 'mellow', 'calm'],
  },
  Focus: {
    genres: ['Ambient', 'Classical', 'Jazz', 'Lo-Fi', 'Downtempo'],
    moods: ['focused', 'contemplative', 'meditative', 'peaceful', 'sophisticated', 'gentle', 'calm'],
    tags: ['focus', 'study', 'concentration', 'instrumental', 'ambient', 'lofi', 'lo-fi'],
  },
  Melancholy: {
    genres: ['R&B/Soul', 'Alternative', 'Ambient', 'Downtempo'],
    moods: ['melancholy', 'melancholic', 'sad', 'somber', 'sentimental', 'emotional', 'wistful', 'reflective', 'brooding', 'yearning'],
    tags: ['melancholy', 'sad', 'heartbreak', 'emotional', 'moody', 'somber', 'wistful'],
  },
  Motivation: {
    genres: ['Rock', 'Hip-Hop/Rap', 'Electronic', 'Pop'],
    moods: ['empowering', 'energizing', 'uplifting', 'inspiring', 'triumphant', 'confident', 'upbeat', 'excited', 'stirring'],
    tags: ['motivation', 'motivational', 'workout', 'training', 'inspiring', 'uplifting', 'energy'],
  },
  Party: {
    genres: ['Electronic', 'House', 'Dance & EDM', 'Hip-Hop/Rap', 'Pop'],
    moods: ['upbeat', 'energizing', 'rowdy', 'fiery', 'fun', 'celebratory', 'excited', 'aggressive', 'defiant'],
    tags: ['party', 'dance', 'club', 'festival', 'rave', 'edm', 'house'],
  },
  Romantic: {
    genres: ['R&B/Soul', 'Pop', 'Electronic', 'Hip-Hop/Rap'],
    moods: ['romantic', 'tender', 'sensual', 'sentimental', 'yearning', 'peaceful', 'easygoing'],
    tags: ['love', 'romantic', 'romance', 'slow jam', 'date night', 'heart'],
  },
};

function seededNumber(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += value << 13;
    value ^= value >>> 7;
    value += value << 3;
    value ^= value >>> 17;
    value += value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: string) {
  const next = [...items];
  const random = seededNumber(seed);
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function variedTracks(items: CrimsonSong[], count: number, seed: string) {
  const chosen: CrimsonSong[] = [];
  const artistIds = new Set<string>();
  const candidates = shuffled(Array.from(new Map(items.map((song) => [song.id, song])).values()), seed);
  candidates.forEach((song) => {
    if (chosen.length >= count || (song.artistId && artistIds.has(song.artistId))) return;
    chosen.push(song);
    if (song.artistId) artistIds.add(song.artistId);
  });
  candidates.forEach((song) => {
    if (chosen.length < count && !chosen.some((item) => item.id === song.id)) chosen.push(song);
  });
  return chosen.slice(0, count);
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function songSnapshot(song: CrimsonSong) {
  return compactObject({ ...song, url: '' });
}

function songFromData(data: Record<string, unknown>, fallbackId = ''): CrimsonSong {
  const artwork = data.artwork && typeof data.artwork === 'object'
    ? data.artwork as CrimsonSong['artwork']
    : { small: String(data.imageSmall || ''), medium: String(data.image || ''), large: String(data.image || ''), mirrors: [] };
  return {
    id: String(data.id || fallbackId),
    source: 'audius',
    title: String(data.title || 'Untitled track'),
    creator: String(data.creator || 'Unknown artist'),
    artistId: String(data.artistId || ''),
    artistHandle: String(data.artistHandle || ''),
    image: String(data.image || artwork.large || ''),
    imageSmall: String(data.imageSmall || artwork.small || ''),
    artwork,
    url: '',
    color: String(data.color || '#251E2C'),
    categories: String(data.categories || ''),
    genre: String(data.genre || ''),
    mood: String(data.mood || ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    duration: Number(data.duration || 0),
    description: String(data.description || ''),
    permalink: String(data.permalink || ''),
    releaseDate: String(data.releaseDate || ''),
    playCount: Number(data.playCount || 0),
    favoriteCount: Number(data.favoriteCount || 0),
    streamable: data.streamable !== false,
    downloadable: data.downloadable === true,
  };
}

function categoryById(categoryId: string) {
  return categories.find((category) => category.id === categoryId) || {
    id: categoryId,
    name: categoryId.split('-').map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : '').join(' '),
    color: '#5632A8',
    image: '',
    imageSmall: '',
  };
}

export function normalizeRemoteImageUrl(value: string) {
  return value;
}

export async function resolveTrackPlaybackUrl(track: Pick<CrimsonSong, 'id' | 'source' | 'url'>) {
  return track.source === 'audius' ? resolveAudiusStreamUrl(track.id) : track.url;
}

export async function loadMusicCatalog(): Promise<MusicCatalog> {
  const songs = await getTrendingAudiusTracks(24);
  const artists = Array.from(new Map(songs.filter((song) => song.artistId).map((song) => [song.artistId, {
    id: song.artistId,
    source: 'audius' as const,
    handle: song.artistHandle,
    name: song.creator,
    image: '',
    imageSmall: '',
    artwork: { small: '', medium: '', large: '', mirrors: [] },
    aboutImage: '',
    followers: '0',
    trackCount: 0,
    description: '',
    twitterHandle: '',
    instagramHandle: '',
    tiktokHandle: '',
    website: '',
  }])).values());
  return { songs, artists };
}

export async function loadDiscoveryCatalog(searchQuery = ''): Promise<DiscoveryCatalog> {
  const normalized = searchQuery.trim();
  if (!normalized) return { songs: [], artists: [], playlists: [], categories, profiles: [], events: [] };
  const [audius, events] = await Promise.all([
    searchAudius(normalized, 12),
    getAudiusEvents(12, normalized).catch(() => []),
  ]);
  return { ...audius, categories, profiles: [], events };
}

type AudiusTrackRecord = Parameters<typeof mapAudiusTrack>[0];
type AudiusArtistRecord = Parameters<typeof mapAudiusArtist>[0];
type AudiusPlaylistRecord = Parameters<typeof mapAudiusPlaylist>[0] & {
  is_private?: boolean;
  playlist_contents?: { track_id?: string; timestamp?: number; metadata_timestamp?: number }[];
};
type AudiusActivity<T> = { item: T };

// Audius mutations are indexed asynchronously. Keep acknowledged writes briefly so a
// second edit cannot overwrite the first with an older discovery-node response.
const confirmedPlaylistEdits = new Map<string, { expiresAt: number; record: AudiusPlaylistRecord }>();
const confirmedCollectionStates = new Map<string, { expiresAt: number; value: boolean }>();
registerAccountCleanup((uid) => {
  for (const key of confirmedPlaylistEdits.keys()) if (key.startsWith(`${uid}:`)) confirmedPlaylistEdits.delete(key);
  for (const key of confirmedCollectionStates.keys()) if (key.startsWith(`${uid}:`)) confirmedCollectionStates.delete(key);
});

function requireUser(uid: string) {
  if (!uid || getCurrentAudiusUserId() !== uid || isAccountDeleted(uid)) {
    throw new Error('Your session has expired. Please log in with Audius again.');
  }
}

function userPath(uid: string, suffix: string) {
  return `/users/${encodeURIComponent(uid)}${suffix}`;
}

function withUser(path: string, uid: string) {
  return `${path}${path.includes('?') ? '&' : '?'}user_id=${encodeURIComponent(uid)}`;
}

async function readAudiusList<T>(path: string): Promise<T[]> {
  const results: T[] = [];
  const pageSize = 100;
  // The library endpoints paginate; do not silently truncate a listener's collection.
  for (let offset = 0; ; offset += pageSize) {
    const payload = await audiusRequest<{ data: T[] }>(`${path}${path.includes('?') ? '&' : '?'}limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(payload.data)) throw new Error('Audius returned an invalid library response.');
    results.push(...payload.data);
    if (payload.data.length < pageSize) return results;
  }
}

async function readAudiusPlaylist(playlistId: string, uid?: string): Promise<AudiusPlaylistRecord> {
  const confirmed = uid ? confirmedPlaylistEdits.get(`${uid}:${playlistId}`) : undefined;
  if (confirmed && confirmed.expiresAt > Date.now()) return confirmed.record;
  const path = `/playlists/${encodeURIComponent(playlistId)}`;
  const response = await audiusRequest<{ data: AudiusPlaylistRecord[] | AudiusPlaylistRecord }>(uid ? withUser(path, uid) : path);
  const record = Array.isArray(response.data) ? response.data[0] : response.data;
  if (!record?.id) throw new Error('Audius playlist was not found.');
  return record;
}

function playlistFromAudius(record: AudiusPlaylistRecord, uid?: string) {
  return {
    ...mapAudiusPlaylist(record),
    owned: Boolean(uid && record.user?.id === uid),
    visibility: record.is_private ? 'private' as const : 'public' as const,
  };
}

export async function createOwnedPlaylist(uid: string, title: string, coverUri?: string): Promise<CrimsonPlaylist> {
  requireUser(uid);
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error('Give your playlist a name.');
  if (coverUri) throw new Error('Create the playlist without a cover, then add artwork on Audius.');
  const response = await audiusRequest<{ playlist_id?: string }>(withUser('/playlists', uid), {
    method: 'POST',
    body: { playlist_name: normalizedTitle, is_private: false, is_album: false, playlist_contents: [] },
  });
  requireUser(uid);
  if (!response.playlist_id) throw new Error('Audius did not return the new playlist ID.');
  clearAudiusCaches();
  // Newly accepted writes can take a moment to appear on Audius discovery nodes.
  const artist = await getAudiusArtist(uid).catch(() => null);
  const record: AudiusPlaylistRecord = {
    id: response.playlist_id,
    playlist_name: normalizedTitle,
    user: { id: uid, name: artist?.name || 'Audius listener', handle: artist?.handle },
    playlist_contents: [],
  };
  confirmedPlaylistEdits.set(`${uid}:${record.id}`, { expiresAt: Date.now() + 30_000, record });
  return playlistFromAudius(record, uid);
}

export async function loadLibraryFeed(
  uid: string,
  options: { offlineOnly?: boolean; selectedTrackId?: string } = {},
): Promise<LibraryFeed> {
  requireUser(uid);
  const scope = `library:${uid}`;
  if (options.offlineOnly) {
    return (await readOfflineData<LibraryFeed>(scope)) || { playlists: [], likedPlaylists: [], followedArtists: [] };
  }
  try {
    const [owned, liked, followed] = await Promise.all([
      readAudiusList<AudiusPlaylistRecord>(withUser(userPath(uid, '/playlists'), uid)),
      readAudiusList<AudiusActivity<AudiusPlaylistRecord>>(withUser(userPath(uid, '/library/playlists?type=favorite'), uid)),
      readAudiusList<AudiusArtistRecord>(withUser(userPath(uid, '/following'), uid)),
    ]);
    requireUser(uid);
    const playlistRecords = new Map(owned.map((record) => [record.id, record]));
    for (const [key, confirmed] of confirmedPlaylistEdits) {
      if (key.startsWith(`${uid}:`) && confirmed.expiresAt > Date.now()) playlistRecords.set(confirmed.record.id, confirmed.record);
    }
    const feed: LibraryFeed = {
      playlists: [...playlistRecords.values()].map((record) => playlistFromAudius(record, uid)),
      likedPlaylists: liked.map(({ item }) => playlistFromAudius(item, uid)),
      followedArtists: followed.map(mapAudiusArtist),
    };
    // playlist_contents includes every track ID, so picker membership uses the full collection.
    await saveOfflineData(scope, feed);
    return feed;
  } catch (error) {
    if (options.selectedTrackId) throw error;
    const cached = await readOfflineData<LibraryFeed>(scope);
    if (cached) return cached;
    throw error;
  }
}

export async function getUserCollectionState(uid: string, field: CrimsonCollectionField, id: string) {
  requireUser(uid);
  const confirmed = confirmedCollectionStates.get(`${uid}:${field}:${id}`);
  if (confirmed && confirmed.expiresAt > Date.now()) return confirmed.value;
  const segment = field === 'LikedSongs' ? 'tracks' : field === 'LikedPlaylists' ? 'playlists' : 'users';
  type State = { has_current_user_saved?: boolean; does_current_user_follow?: boolean };
  const response = await audiusRequest<{ data: State | State[] }>(withUser(`/${segment}/${encodeURIComponent(id)}`, uid));
  const record = Array.isArray(response.data) ? response.data[0] : response.data;
  const state = field === 'FollowedArtists' ? record?.does_current_user_follow : record?.has_current_user_saved;
  if (typeof state !== 'boolean') throw new Error('Audius could not confirm your library state. Try again.');
  return state;
}

const libraryWrites = new Map<string, Promise<unknown>>();
function serializeLibraryWrite<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = libraryWrites.get(key) || Promise.resolve();
  const pending = previous.catch(() => undefined).then(action);
  libraryWrites.set(key, pending);
  void pending.finally(() => { if (libraryWrites.get(key) === pending) libraryWrites.delete(key); }).catch(() => undefined);
  return pending;
}

export async function toggleUserCollectionItem(
  uid: string,
  field: CrimsonCollectionField,
  id: string,
  suppliedSnapshot?: CrimsonSong | CrimsonArtist | CrimsonPlaylist,
  sourceHint?: CrimsonPlaylist['source'],
) {
  requireUser(uid);
  if (sourceHint === 'crimson') throw new Error('This old Crimson playlist is unavailable. Open an Audius playlist instead.');
  return serializeLibraryWrite(`${uid}:${field}:${id}`, async () => {
    requireUser(uid);
    const existing = await getUserCollectionState(uid, field, id);
    const path = field === 'FollowedArtists'
      ? `/users/${encodeURIComponent(id)}/follow`
      : `/${field === 'LikedSongs' ? 'tracks' : 'playlists'}/${encodeURIComponent(id)}/favorites`;
    requireUser(uid);
    await audiusRequest(withUser(path, uid), { method: existing ? 'DELETE' : 'POST' });
    requireUser(uid);
    confirmedCollectionStates.set(`${uid}:${field}:${id}`, { expiresAt: Date.now() + 30_000, value: !existing });
    clearAudiusCaches();
    if (field === 'LikedSongs') {
      void recordListeningEvent(uid, existing ? 'unlike' : 'like', id, suppliedSnapshot as CrimsonSong | undefined);
    }
    return !existing;
  });
}

export async function addSongToOwnedPlaylist(uid: string, playlistId: string, songId: string) {
  await setSongInOwnedPlaylist(uid, playlistId, songId, true);
}

export async function setSongInOwnedPlaylist(
  uid: string,
  playlistId: string,
  songId: string,
  shouldInclude?: boolean,
) {
  requireUser(uid);
  return serializeLibraryWrite(`${uid}:playlist:${playlistId}`, async () => {
    requireUser(uid);
    const record = await readAudiusPlaylist(playlistId, uid);
    if (record.user?.id !== uid) throw new Error('You can only edit playlists owned by your Audius account.');
    const contents = record.playlist_contents || [];
    const exists = contents.some((item) => item.track_id === songId);
    const included = shouldInclude ?? !exists;
    if (included === exists) return included;
    const next = included
      ? [...contents, { track_id: songId, timestamp: Math.floor(Date.now() / 1_000) }]
      : contents.filter((item) => item.track_id !== songId);
    requireUser(uid);
    await audiusRequest(withUser(`/playlists/${encodeURIComponent(playlistId)}`, uid), {
      method: 'PUT', body: { playlist_contents: next },
    });
    requireUser(uid);
    confirmedPlaylistEdits.set(`${uid}:${playlistId}`, { expiresAt: Date.now() + 30_000, record: { ...record, playlist_contents: next } });
    clearAudiusCaches();
    void recordListeningEvent(uid, included ? 'playlistAdd' : 'playlistRemove', songId, undefined, { playlistId });
    return included;
  });
}

export async function loadArtistDetail(artistId: string): Promise<ArtistDetail> {
  const [artist, songs, relatedArtists] = await Promise.all([
    getAudiusArtist(artistId),
    getAudiusArtistTracks(artistId, 10),
    getAudiusRelatedArtists(artistId, 12).catch(() => []),
  ]);
  return {
    artist,
    songs,
    relatedArtists,
    appearsOn: [],
    hasMoreTracks: artist.trackCount > songs.length || songs.length === 10,
  };
}

export async function loadArtistTracksPage(artistId: string, offset = 0, pageSize = 30) {
  const songs = await getAudiusArtistTracks(artistId, pageSize, offset);
  return songs;
}

async function loadPlaylistDetailOnline(playlistId: string, uid?: string, owned = false, sourceHint?: CrimsonPlaylist['source']): Promise<PlaylistDetail> {
  if (sourceHint === 'crimson') throw new Error('This old Crimson playlist is unavailable. Open an Audius playlist instead.');
  const [record, songs] = await Promise.all([
    readAudiusPlaylist(playlistId, uid),
    getAudiusPlaylistTracks(playlistId),
  ]);
  const playlist = playlistFromAudius(record, uid);
  if (owned && !playlist.owned) throw new Error('This playlist is not owned by your Audius account.');
  return { playlist: { ...playlist, songs: songs.map((song) => song.id) }, songs };
}

export async function loadPlaylistDetail(
  playlistId: string,
  uid?: string,
  owned = false,
  sourceHint?: CrimsonPlaylist['source'],
  options: { offlineOnly?: boolean } = {},
): Promise<PlaylistDetail> {
  if (uid) requireUser(uid);
  const scope = `playlist:${uid || 'public'}:${sourceHint || 'unknown'}:${playlistId}`;
  if (options.offlineOnly) {
    const cached = await readOfflineData<PlaylistDetail>(scope);
    if (cached) return cached;
    throw new Error('This playlist is not cached for offline listening.');
  }
  try {
    const detail = await loadPlaylistDetailOnline(playlistId, uid, owned, sourceHint);
    await saveOfflineData(scope, detail);
    return detail;
  } catch (error) {
    const cached = await readOfflineData<PlaylistDetail>(scope);
    if (cached) return cached;
    throw error;
  }
}

export async function loadCategoryDetail(categoryId: string): Promise<CategoryDetail> {
  const category = categoryById(categoryId);
  if (categoryId === 'events') {
    const events = await getAudiusEvents(30);
    return { category, songs: [], playlists: [], events };
  }
  const catalog = await getAudiusGenreCatalog(category.name);
  return { category, songs: catalog.songs, playlists: catalog.playlists, events: [] };
}

export async function loadEventDetail(eventId: string) {
  return getAudiusEvent(eventId);
}

export async function loadFavoriteSongs(
  uid: string,
  options: { offlineOnly?: boolean } = {},
): Promise<CrimsonSong[]> {
  requireUser(uid);
  if (options.offlineOnly) {
    return (await readOfflineData<CrimsonSong[]>(`favorites:${uid}`)) || [];
  }
  try {
    const records = await readAudiusList<AudiusActivity<AudiusTrackRecord>>(withUser(userPath(uid, '/library/tracks?type=favorite&sort_method=added_date&sort_direction=desc'), uid));
    const songs = records.map(({ item }) => mapAudiusTrack(item)).filter((song) => song.id);
    await saveOfflineData(`favorites:${uid}`, songs);
    return songs;
  } catch (error) {
    const cached = await readOfflineData<CrimsonSong[]>(`favorites:${uid}`);
    if (cached) return cached;
    throw error;
  }
}

export async function loadAutomaticDownloadTargets(uid: string) {
  const [favorites, library, recentEvents] = await Promise.all([
    loadFavoriteSongs(uid),
    loadLibraryFeed(uid),
    readLocalListeningEvents(uid),
  ]);
  const playsBySource = new Map<string, number>();
  const playsByPlaylistId = new Map<string, number>();
  recentEvents.slice(0, 250).forEach((data) => {
    if (data.type !== 'play') return;
    const playlistId = String(data.playlistId || '').trim();
    if (playlistId) {
      playsByPlaylistId.set(playlistId, (playsByPlaylistId.get(playlistId) || 0) + 1);
    }
    const source = String(data.source || '').trim().toLowerCase();
    if (!source || source === 'home' || source === 'autoplay' || source === 'favorites') return;
    playsBySource.set(source, (playsBySource.get(source) || 0) + 1);
  });
  const playlists = Array.from(new Map(
    [...library.playlists, ...library.likedPlaylists].map((playlist) => [playlist.id, playlist]),
  ).values())
    .map((playlist) => ({
      playlist,
      plays: playsByPlaylistId.get(playlist.id)
        || playsBySource.get(playlist.title.trim().toLowerCase())
        || 0,
    }))
    .filter((item) => item.plays > 0)
    .sort((first, second) => second.plays - first.plays)
    .slice(0, 3);
  const playlistDetails = await Promise.all(playlists.map(({ playlist }) => loadPlaylistDetail(
    playlist.id,
    uid,
    Boolean(playlist.owned),
    playlist.source,
  ).catch(() => null)));
  return {
    favorites,
    playlists: playlistDetails.flatMap((detail, index) => detail
      ? [{
          id: playlists[index].playlist.id,
          songs: detail.songs,
        }]
      : []),
  };
}

export async function loadPlayerLyrics(_songId: string): Promise<PlayerLyrics> {
  // Audius does not currently expose licensed lyrics or timed lyric data.
  return { lyrics: [], karaoke: [] };
}

export async function loadRelatedSongs(songId: string, count = 8): Promise<RelatedSong[]> {
  const current = await getAudiusTrack(songId);
  const [artistTracks, genreTracks, recommendedTracks] = await Promise.all([
    current.artistId ? getAudiusArtistTracks(current.artistId, 18).catch(() => []) : Promise.resolve([]),
    current.genre ? getTrendingAudiusTracks(24, current.genre).catch(() => []) : Promise.resolve([]),
    loadCachedHomeTracks(getCurrentAudiusUserId() || undefined).catch(() => []),
  ]);
  const related: RelatedSong[] = [];
  const seen = new Set([songId]);
  const add = (song: CrimsonSong, reason: RelatedSong['reason']) => {
    if (!song.id || seen.has(song.id) || related.length >= count) return;
    seen.add(song.id);
    related.push({ ...song, reason });
  };
  artistTracks.forEach((song) => add(song, 'Artist'));
  genreTracks.forEach((song) => add(song, 'Similar vibe'));
  recommendedTracks.forEach((song) => add(song, 'For you'));
  return related;
}

export async function loadPlayerExtras(songId: string, count = 8): Promise<PlayerExtras> {
  const [lyrics, related] = await Promise.all([
    loadPlayerLyrics(songId),
    loadRelatedSongs(songId, count),
  ]);
  return { ...lyrics, related };
}

const discoveryCache = new RequestCache(24);
registerAccountCleanup(() => discoveryCache.clear());

async function loadCachedHomeTracks(uid?: string, limit = discoveryRequestLimits().tracks) {
  if (uid) {
    const response = await discoveryCache.get(`recommendations:${uid}:${limit}`, () =>
      audiusRequest<{ data: AudiusTrackRecord[] }>(withUser(userPath(uid, `/recommended-tracks?limit=${limit}`), uid)), 5 * 60_000);
    const tracks = (response.data || []).map(mapAudiusTrack).filter((song) => song.id && song.streamable);
    if (tracks.length) return tracks;
  }
  return getRecommendedAudiusTracks(limit);
}

function vaultTrackScore(track: CrimsonSong, profile: (typeof vaultMoodProfiles)[VaultMood]) {
  const mood = track.mood.toLowerCase();
  const genre = track.genre.toLowerCase();
  const tags = `${track.tags.join(' ')} ${track.categories}`.toLowerCase();
  const moodScore = profile.moods.some((value) => mood.includes(value)) ? 8 : 0;
  const genreScore = profile.genres.some((value) => genre.includes(value.toLowerCase())) ? 3 : 0;
  const tagScore = profile.tags.some((value) => tags.includes(value)) ? 2 : 0;
  return moodScore + genreScore + tagScore;
}

export async function loadVaultMood(mood: VaultMood, uid = getCurrentAudiusUserId() || undefined) {
  const profile = vaultMoodProfiles[mood];
  const limits = discoveryRequestLimits();
  const [personalized, recommended, ...genreGroups] = await Promise.all([
    loadCachedHomeTracks(uid, limits.tracks).catch(() => []),
    getRecommendedAudiusTracks(Math.min(50, limits.tracks)).catch(() => []),
    ...profile.genres.slice(0, limits.vaultGenres).map((genre) => getTrendingAudiusTracks(limits.vaultTracks, genre).catch(() => [])),
  ]);
  const candidates = Array.from(new Map(
    [...personalized, ...recommended, ...genreGroups.flat()].map((song) => [song.id, song]),
  ).values());
  const seed = `${uid || 'guest'}:${mood}:${Math.floor(Date.now() / 3_600_000)}`;
  const ranked = shuffled(candidates, seed)
    .map((song) => ({ score: vaultTrackScore(song, profile), song }))
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score)
    .map((item) => item.song);
  const selected: CrimsonSong[] = [];
  const artistIds = new Set<string>();
  ranked.forEach((song) => {
    if (selected.length >= 30 || (song.artistId && artistIds.has(song.artistId))) return;
    selected.push(song);
    if (song.artistId) artistIds.add(song.artistId);
  });
  ranked.forEach((song) => {
    if (selected.length < 30 && !selected.some((item) => item.id === song.id)) selected.push(song);
  });
  return selected;
}

export async function loadHomeFeed(uid = getCurrentAudiusUserId() || undefined, rotation = Date.now(), onSongsReady?: (songs: CrimsonSong[]) => void) {
  const limits = discoveryRequestLimits();
  const scope = `home:${uid || 'guest'}`;
  const seed = `${uid || 'guest'}:${rotation}`;
  try {
    const genre = homeArtistGenres[Math.abs(Math.floor(rotation / 1000)) % homeArtistGenres.length];
    // These sources are independent: start them together, not in three waves.
    const [selectedSongs, topArtists, genreArtists, playlistRecords] = await Promise.all([
      loadCachedHomeTracks(uid, limits.tracks).catch(() => []).then(async (cachedSongs) => {
        if (cachedSongs.length) return cachedSongs;
        const trending = await getTrendingAudiusTracks(limits.tracks);
        return trending;
      }).then((songs) => {
        const selected = variedTracks(songs, 5, `${seed}:tracks`);
        if (!uid || !isAccountDeleted(uid)) onSongsReady?.(selected);
        return selected;
      }),
      getTopAudiusArtists(limits.artists).catch(() => []),
      limits.extraArtists ? getTopAudiusArtists(limits.extraArtists, genre).catch(() => []) : Promise.resolve([]),
      discoveryCache.get(`playlists:${uid || 'guest'}:${limits.playlists}`, () =>
        audiusRequest<{ data: AudiusPlaylistRecord[] }>(`/playlists/trending?limit=${limits.playlists}&time=week`), 5 * 60_000)
        .then((response) => response.data || []).catch(() => []),
    ]);
    const homeSongArtists = new Set(selectedSongs.map((song) => song.artistId).filter(Boolean));
    const artists = shuffled(
      Array.from(new Map([...topArtists, ...genreArtists].map((artist) => [artist.id, artist])).values())
        .filter((artist) => !homeSongArtists.has(artist.id)),
      `${seed}:artists`,
    ).slice(0, 10);
    const playlists = playlistRecords.map((record) => playlistFromAudius(record, uid));
    const feed = {
      songs: selectedSongs,
      artists,
      playlists: playlists.slice(0, 6),
      featuredArtist: artists[artists.length - 1] || null,
    };
    void saveOfflineData(scope, feed).catch(() => undefined);
    return feed;
  } catch (error) {
    const cached = await readOfflineData<{
      artists: CrimsonArtist[];
      featuredArtist: CrimsonArtist | null;
      playlists: CrimsonPlaylist[];
      songs: CrimsonSong[];
    }>(scope);
    if (cached) return cached;
    throw error;
  }
}

export type LocalListeningEvent = {
  id: string;
  type: ListeningEventType;
  trackId: string;
  snapshot: Record<string, unknown> | null;
  source: string;
  playedSeconds: number;
  duration: number;
  playlistId: string;
  localDayKey: string;
  localMonthKey: string;
  occurredAt: number;
};

const historyWrites = new Map<string, Promise<void>>();
registerAccountCleanup(async (uid) => {
  await historyWrites.get(uid)?.catch(() => undefined);
  await Promise.allSettled([...libraryWrites.entries()].filter(([key]) => key.startsWith(`${uid}:`)).map(([, pending]) => pending));
});

export async function readLocalListeningEvents(uid: string): Promise<LocalListeningEvent[]> {
  await historyWrites.get(uid)?.catch(() => undefined);
  return await readOfflineData<LocalListeningEvent[]>(`history:${uid}`) || [];
}

export async function recordListeningEvent(
  uid: string,
  type: ListeningEventType,
  trackId: string,
  track?: CrimsonSong,
  extra: Record<string, unknown> = {},
) {
  if (!uid || uid !== getCurrentAudiusUserId() || isAccountDeleted(uid)) return;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const event: LocalListeningEvent = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2)}`,
    type,
    trackId,
    snapshot: track ? songSnapshot(track) : null,
    source: String(extra.source || ''),
    playedSeconds: Math.max(0, Number(extra.playedSeconds || 0)) || 0,
    duration: Math.max(0, Number(extra.duration || track?.duration || 0)) || 0,
    playlistId: String(extra.playlistId || ''),
    localDayKey: `${monthKey}-${String(now.getDate()).padStart(2, '0')}`,
    localMonthKey: monthKey,
    occurredAt: now.getTime(),
  };
  const previous = historyWrites.get(uid) || Promise.resolve();
  const pending = previous.catch(() => undefined).then(async () => {
    if (uid !== getCurrentAudiusUserId() || isAccountDeleted(uid)) return;
    const history = await readOfflineData<LocalListeningEvent[]>(`history:${uid}`) || [];
    // Local playback statistics never require a backend or write to the Audius account.
    await saveOfflineData(`history:${uid}`, [event, ...history].slice(0, 20_000));
    listeningStatsCache.delete(`${uid}:${monthKey}`);
  });
  historyWrites.set(uid, pending);
  try {
    await pending;
  } catch (error) {
    reportError(error, 'listening.persist');
  } finally {
    if (historyWrites.get(uid) === pending) historyWrites.delete(uid);
  }
}

export async function loadListeningHistoryPage(
  uid: string,
  after: ListeningHistoryCursor | null = null,
  pageSize = 15,
): Promise<ListeningHistoryPage> {
  requireUser(uid);
  const events = await readLocalListeningEvents(uid);
  const seenTrackIds = new Set(after?.seenTrackIds || []);
  const cursorIndex = after ? events.findIndex((event) => event.id === after.event) : -1;
  const start = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const items: ListeningHistoryEntry[] = [];
  let eventCursor = after?.event || null;
  let index = start;
  const count = Math.max(1, Math.floor(pageSize));
  for (; index < events.length && items.length < count; index += 1) {
    const event = events[index];
    eventCursor = event.id;
    if (event.type !== 'play' || !event.snapshot || !event.trackId || seenTrackIds.has(event.trackId)) continue;
    seenTrackIds.add(event.trackId);
    items.push({
      id: event.id,
      playedAt: new Date(event.occurredAt),
      song: songFromData(event.snapshot, event.trackId),
    });
  }
  const hasMore = events.slice(index).some((event) => event.type === 'play' && event.snapshot && event.trackId && !seenTrackIds.has(event.trackId));
  return { items, cursor: eventCursor ? { event: eventCursor, seenTrackIds: [...seenTrackIds] } : null, hasMore };
}

export async function loadMonthlyListeningStats(
  uid: string,
  options: { force?: boolean; month?: Date } = {},
): Promise<ProfileListeningStats> {
  requireUser(uid);
  const requestedMonth = options.month && Number.isFinite(options.month.getTime()) ? options.month : new Date();
  const monthKey = `${requestedMonth.getFullYear()}-${String(requestedMonth.getMonth() + 1).padStart(2, '0')}`;
  const cacheKey = `${uid}:${monthKey}`;
  const cached = listeningStatsCache.get(cacheKey);
  if (!options.force && cached && cached.expiresAt > Date.now()) return cached.value;
  const inFlight = listeningStatsRequests.get(cacheKey);
  if (!options.force && inFlight) return inFlight;
  const request = (async (): Promise<ProfileListeningStats> => {
    const events = (await readLocalListeningEvents(uid)).filter((event) => event.localMonthKey === monthKey);
    const plays = events.filter((event) => event.type === 'play');
    const tracks = new Map<string, MonthlyTopTrack>();
    const artists = new Map<string, MonthlyTopArtist>();
    const listeningDays = [...new Set(plays.map((event) => Number(event.localDayKey.slice(-2))))].sort((a, b) => a - b);
    for (const event of plays) {
      if (!event.snapshot) continue;
      const song = songFromData(event.snapshot, event.trackId);
      const existing = tracks.get(song.id);
      tracks.set(song.id, {
        artistId: song.artistId, creator: song.creator, id: song.id,
        image: song.image, imageSmall: song.imageSmall, title: song.title,
        plays: (existing?.plays || 0) + 1,
      });
      const artistKey = song.artistId || song.creator;
      const artist = artists.get(artistKey) || { id: song.artistId, name: song.creator, image: '', imageSmall: '', plays: 0, songs: [] };
      artist.plays += 1;
      artists.set(artistKey, artist);
    }
    const rankedTracks = [...tracks.values()].sort((a, b) => b.plays - a.plays);
    const rankedArtists = [...artists.values()].sort((a, b) => b.plays - a.plays);
    const topArtists = await Promise.all(rankedArtists.slice(0, 3).map(async (artist) => {
      const profile = artist.id ? await getAudiusArtist(artist.id).catch(() => null) : null;
      return {
        ...artist,
        image: profile?.image || '', imageSmall: profile?.imageSmall || '',
        songs: rankedTracks.filter((track) => artist.id ? track.artistId === artist.id : track.creator === artist.name).slice(0, 2),
      };
    }));
    let longestStreak = 0;
    let streak = 0;
    listeningDays.forEach((day, index) => {
      streak = index > 0 && day === listeningDays[index - 1] + 1 ? streak + 1 : 1;
      longestStreak = Math.max(longestStreak, streak);
    });
    const seconds = events.reduce((sum, event) => {
      // Complete/skip is recorded once at the end of a play; counting play events as well would double minutes.
      if (event.type !== 'complete' && event.type !== 'skip') return sum;
      const elapsed = Number.isFinite(event.playedSeconds) ? event.playedSeconds : 0;
      return sum + Math.max(0, event.duration > 0 ? Math.min(elapsed, event.duration) : elapsed);
    }, 0);
    const value: ProfileListeningStats = {
      artists: artists.size,
      listeningDays: listeningDays.length,
      listeningDaysOfMonth: listeningDays,
      longestStreak,
      minutes: Math.floor(seconds / 60),
      plays: plays.length,
      topArtist: rankedArtists[0]?.name || '',
      topArtistPlays: rankedArtists[0]?.plays || 0,
      topArtists,
      topTracks: rankedTracks.slice(0, 6),
      uniqueTracks: new Set(plays.map((event) => event.trackId).filter(Boolean)).size,
    };
    if (!isAccountDeleted(uid) && uid === getCurrentAudiusUserId()) listeningStatsCache.set(cacheKey, { expiresAt: Date.now() + 60_000, value });
    return value;
  })();
  listeningStatsRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    if (listeningStatsRequests.get(cacheKey) === request) listeningStatsRequests.delete(cacheKey);
  }
}
