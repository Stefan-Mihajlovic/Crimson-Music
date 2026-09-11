import {
  ArtworkSet,
  CrimsonArtist,
  CrimsonEvent,
  CrimsonPlaylist,
  CrimsonSong,
  DiscoveryCatalog,
} from '@/types/music';

import { RequestCache } from '@/services/request-cache';
import { audiusFetch, getCurrentAudiusUserId } from '@/services/audius-session';

const API_BASE = 'https://api.audius.co/v1';

type AudiusArtwork = {
  '150x150'?: string;
  '480x480'?: string;
  '1000x1000'?: string;
  '640x'?: string;
  '2000x'?: string;
  mirrors?: string[];
} | null;

type AudiusUser = {
  id?: string;
  name?: string;
  handle?: string;
  bio?: string | null;
  description?: string | null;
  follower_count?: number;
  track_count?: number;
  profile_picture?: AudiusArtwork;
  cover_photo?: AudiusArtwork;
  twitter_handle?: string | null;
  instagram_handle?: string | null;
  tiktok_handle?: string | null;
  website?: string | null;
};

type AudiusTrack = {
  id?: string;
  title?: string;
  description?: string | null;
  genre?: string | null;
  mood?: string | null;
  tags?: string | null;
  duration?: number;
  release_date?: string | null;
  permalink?: string;
  artwork?: AudiusArtwork;
  user?: AudiusUser;
  play_count?: number;
  favorite_count?: number;
  is_downloadable?: boolean;
  is_streamable?: boolean;
  access?: { stream?: boolean; download?: boolean } | null;
};

type AudiusPlaylist = {
  id?: string;
  playlist_name?: string;
  description?: string | null;
  artwork?: AudiusArtwork;
  favorite_count?: number;
  is_album?: boolean;
  user?: AudiusUser;
  playlist_contents?: { track_id?: string }[];
};

type AudiusEvent = {
  event_id?: string;
  event_type?: 'remix_contest' | 'live_event' | 'new_release';
  user_id?: string;
  entity_id?: string;
  entity_type?: 'track' | 'collection' | 'user';
  end_date?: string | null;
  created_at?: string;
  permalink?: string | null;
  event_data?: {
    title?: string;
    description?: string;
    prize_info?: string;
    cover_photo_url?: string;
  };
};

type AudiusEventsResponse = {
  data?: AudiusEvent[];
  related?: {
    users?: AudiusUser[];
    tracks?: AudiusTrack[];
    entry_counts?: Record<string, number>;
  };
};

type AudiusResponse<T> = { data?: T };

const responseCache = new RequestCache();
const resolvedStreamCache = new RequestCache(128);

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchAudius<T>(
  url: string,
  init: RequestInit,
  consume: (response: Response) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    init?.signal?.addEventListener('abort', cancel, { once: true });
    if (init?.signal?.aborted) controller.abort();
    const timeout = setTimeout(cancel, 8_000);
    try {
      const response = await audiusFetch(url.replace(API_BASE, ''), {
        ...init,
        signal: controller.signal,
      });
      // Keep the deadline active through body decoding, not just response headers.
      if ((response.status !== 429 && response.status < 500) || attempt === 2)
        return await consume(response);
      const retryAfter = Number(response.headers.get('retry-after') || 0);
      await response.body?.cancel();
      await wait(
        retryAfter > 0
          ? Math.min(retryAfter * 1_000, 2_000)
          : 350 * 2 ** attempt,
      );
    } finally {
      clearTimeout(timeout);
      init?.signal?.removeEventListener('abort', cancel);
    }
  }
  throw new Error('Audius request did not finish.');
}

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCount(value: unknown) {
  const count = safeNumber(value);
  if (count >= 1_000_000)
    return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1)}M`;
  if (count >= 1_000)
    return `${(count / 1_000).toFixed(count >= 100_000 ? 0 : 1)}K`;
  return String(count);
}

function artworkFrom(value: AudiusArtwork): ArtworkSet {
  return {
    small: value?.['150x150'] || value?.['480x480'] || value?.['640x'] || '',
    medium: value?.['480x480'] || value?.['640x'] || value?.['150x150'] || '',
    large:
      value?.['1000x1000'] ||
      value?.['2000x'] ||
      value?.['480x480'] ||
      value?.['640x'] ||
      '',
    mirrors: Array.isArray(value?.mirrors) ? value.mirrors.filter(Boolean) : [],
  };
}

function tagsFrom(value: string | null | undefined) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function socialHandle(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '');
}

export function mapAudiusTrack(record: AudiusTrack): CrimsonSong {
  const artwork = artworkFrom(record.artwork || null);
  const genre = String(record.genre || '').trim();
  const mood = String(record.mood || '').trim();
  const tags = tagsFrom(record.tags);
  const artist = record.user || {};
  return {
    id: String(record.id || ''),
    source: 'audius',
    title: String(record.title || 'Untitled track').trim(),
    creator: String(artist.name || artist.handle || 'Unknown artist').trim(),
    artistId: String(artist.id || ''),
    artistHandle: String(artist.handle || ''),
    image: artwork.large,
    imageSmall: artwork.small,
    artwork,
    url: '',
    color: '#251E2C',
    categories: [genre, mood, ...tags].filter(Boolean).join(', '),
    genre,
    mood,
    tags,
    duration: safeNumber(record.duration),
    description: String(record.description || ''),
    permalink: String(record.permalink || ''),
    releaseDate: String(record.release_date || ''),
    playCount: safeNumber(record.play_count),
    favoriteCount: safeNumber(record.favorite_count),
    streamable:
      record.is_streamable !== false && record.access?.stream !== false,
    downloadable:
      record.is_downloadable === true && record.access?.download !== false,
  };
}

export function mapAudiusArtist(record: AudiusUser): CrimsonArtist {
  const artwork = artworkFrom(record.profile_picture || null);
  const cover = artworkFrom(record.cover_photo || null);
  return {
    id: String(record.id || ''),
    source: 'audius',
    handle: String(record.handle || ''),
    name: String(record.name || record.handle || 'Unknown artist').trim(),
    image: artwork.large,
    imageSmall: artwork.small,
    artwork,
    aboutImage: cover.large,
    followers: formatCount(record.follower_count),
    trackCount: safeNumber(record.track_count),
    description: String(record.bio || record.description || '').trim(),
    twitterHandle: socialHandle(record.twitter_handle),
    instagramHandle: socialHandle(record.instagram_handle),
    tiktokHandle: socialHandle(record.tiktok_handle),
    website: String(record.website || '').trim(),
  };
}

export function mapAudiusPlaylist(record: AudiusPlaylist): CrimsonPlaylist {
  const artwork = artworkFrom(record.artwork || null);
  const owner = record.user || {};
  return {
    id: String(record.id || ''),
    source: 'audius',
    title: String(record.playlist_name || 'Untitled playlist').trim(),
    description: String(record.description || ''),
    artists: `by ${String(owner.name || owner.handle || 'Audius')}`,
    ownerId: String(owner.id || ''),
    ownerName: String(owner.name || owner.handle || ''),
    image: artwork.large,
    imageSmall: artwork.small,
    artwork,
    likes: formatCount(record.favorite_count),
    songs: (record.playlist_contents || [])
      .map((item) => String(item.track_id || ''))
      .filter(Boolean),
    category: record.is_album ? 'Album' : '',
  };
}

async function audiusGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  cacheMs = 0,
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '')
      url.searchParams.set(key, String(value));
  });
  const requestUrl = url.toString();
  const key = `${getCurrentAudiusUserId() || 'signed-out'}:${requestUrl}`;
  return responseCache.get(
    key,
    async () => {
      return fetchAudius(requestUrl, {}, async (response) => {
        if (!response.ok)
          throw new Error(`Audius request failed (${response.status}).`);
        const payload = (await response.json()) as AudiusResponse<T>;
        if (payload.data === undefined)
          throw new Error('Audius returned an empty response.');
        return payload.data;
      });
    },
    cacheMs,
  );
}

async function audiusGetPayload<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  cacheMs = 0,
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '')
      url.searchParams.set(key, String(value));
  });
  const key = `payload:${getCurrentAudiusUserId() || 'signed-out'}:${url.toString()}`;
  return responseCache.get(
    key,
    async () => {
      return fetchAudius(url.toString(), {}, async (response) => {
        if (!response.ok)
          throw new Error(`Audius request failed (${response.status}).`);
        return (await response.json()) as T;
      });
    },
    cacheMs,
  );
}

export async function searchAudius(
  query: string,
  limit = 12,
): Promise<Pick<DiscoveryCatalog, 'songs' | 'artists' | 'playlists'>> {
  const normalized = query.trim();
  if (normalized.length < 2) return { songs: [], artists: [], playlists: [] };
  const data = await audiusGet<{
    tracks?: AudiusTrack[];
    users?: AudiusUser[];
    playlists?: AudiusPlaylist[];
    albums?: AudiusPlaylist[];
  }>('/search/full', { query: normalized, limit, kind: 'all' }, 60_000);
  return {
    songs: (data.tracks || [])
      .map(mapAudiusTrack)
      .filter((track) => track.id && track.streamable),
    artists: (data.users || [])
      .map(mapAudiusArtist)
      .filter((artist) => artist.id),
    playlists: [...(data.playlists || []), ...(data.albums || [])]
      .map(mapAudiusPlaylist)
      .filter((playlist) => playlist.id),
  };
}

export async function getTrendingAudiusTracks(limit = 20, genre?: string) {
  const records = await audiusGet<AudiusTrack[]>(
    '/tracks/trending',
    {
      limit,
      genre,
      time: 'week',
    },
    5 * 60_000,
  );
  return records
    .map(mapAudiusTrack)
    .filter((track) => track.id && track.streamable);
}

export type AudiusDiscoveryMix = 'lucky' | 'underground' | 'most-shared';

// Audius smart-playlist endpoints: https://api.audius.co/v1
export async function getAudiusDiscoveryMix(mix: AudiusDiscoveryMix, limit = 25) {
  const paths: Record<AudiusDiscoveryMix, string> = {
    lucky: '/tracks/feeling-lucky',
    underground: '/tracks/trending/underground',
    'most-shared': '/tracks/most-shared',
  };
  const records = await audiusGet<AudiusTrack[]>(
    paths[mix],
    {
      limit: Math.min(100, Math.max(1, limit)),
      user_id: getCurrentAudiusUserId() || undefined,
      ...(mix === 'lucky' ? { with_users: true } : {}),
      ...(mix === 'most-shared' ? { time_range: 'week' } : {}),
    },
    // Feeling Lucky should return a fresh selection on each tap.
    mix === 'lucky' ? 0 : 5 * 60_000,
  );
  return [...new Map(records.map(mapAudiusTrack)
    .filter((track) => track.id && track.streamable)
    .map((track) => [track.id, track])).values()];
}

export async function getRecommendedAudiusTracks(limit = 20) {
  const records = await audiusGet<AudiusTrack[]>(
    '/tracks/recommended',
    { limit },
    5 * 60_000,
  );
  return records
    .map(mapAudiusTrack)
    .filter((track) => track.id && track.streamable);
}

export async function getTopAudiusArtists(limit = 24, genre?: string) {
  const path = genre ? '/users/genre/top' : '/users/top';
  const records = await audiusGet<AudiusUser[]>(
    path,
    { limit, genre },
    10 * 60_000,
  );
  return records
    .map(mapAudiusArtist)
    .filter(
      (artist) =>
        artist.id &&
        artist.imageSmall &&
        artist.trackCount > 0 &&
        artist.handle.toLowerCase() !== 'audius',
    );
}

export async function getAudiusTrack(trackId: string) {
  const record = await audiusGet<AudiusTrack>(
    `/tracks/${encodeURIComponent(trackId)}`,
    {},
    5 * 60_000,
  );
  return mapAudiusTrack(record);
}

export async function getAudiusArtist(artistId: string) {
  const record = await audiusGet<AudiusUser>(
    `/users/${encodeURIComponent(artistId)}`,
    {},
    5 * 60_000,
  );
  return mapAudiusArtist(record);
}

export type AudiusPage<T> = {
  items: T[];
  nextOffset: number;
  hasMore: boolean;
};

export async function getAudiusArtistTracksPage(
  artistId: string,
  limit = 30,
  offset = 0,
  sort: 'date' | 'plays' | 'title' | 'artist' = 'date',
  query = '',
): Promise<AudiusPage<CrimsonSong>> {
  const records = await audiusGet<AudiusTrack[]>(
    `/users/${encodeURIComponent(artistId)}/tracks`,
    {
      limit,
      offset,
      sort_method:
        sort === 'plays'
          ? 'plays'
          : sort === 'title'
            ? 'title'
            : sort === 'artist'
              ? 'artist_name'
              : 'release_date',
      sort_direction: sort === 'title' || sort === 'artist' ? 'asc' : 'desc',
      query,
    },
    5 * 60_000,
  );
  return {
    items: records
      .map(mapAudiusTrack)
      .filter((track) => track.id && track.streamable),
    nextOffset: offset + records.length,
    hasMore: records.length === limit,
  };
}

export async function getAudiusArtistTracks(
  artistId: string,
  limit = 50,
  offset = 0,
) {
  return (await getAudiusArtistTracksPage(artistId, limit, offset)).items;
}

export async function getAudiusArtistCollections(artistId: string) {
  const [albums, playlists] = await Promise.all([
    audiusGet<AudiusPlaylist[]>(
      `/users/${encodeURIComponent(artistId)}/albums`,
      { limit: 30 },
      5 * 60_000,
    ),
    audiusGet<AudiusPlaylist[]>(
      `/users/${encodeURIComponent(artistId)}/playlists`,
      { limit: 30, sort_method: 'recent' },
      5 * 60_000,
    ),
  ]);
  return [
    ...new Map(
      [...albums, ...playlists]
        .map(mapAudiusPlaylist)
        .filter((playlist) => playlist.id)
        .map((playlist) => [playlist.id, playlist]),
    ).values(),
  ];
}

export type AudiusSearchKind = 'songs' | 'artists' | 'playlists';
export type AudiusSearchItem = CrimsonSong | CrimsonArtist | CrimsonPlaylist;

export async function searchAudiusPage(
  query: string,
  kind: AudiusSearchKind,
  offset = 0,
  limit = 30,
): Promise<AudiusPage<AudiusSearchItem>> {
  const normalized = query.trim();
  if (normalized.length < 2)
    return { items: [], nextOffset: 0, hasMore: false };
  const params = { query: normalized, offset, limit, sort_method: 'relevant' };
  if (kind === 'songs') {
    const records = await audiusGet<AudiusTrack[]>(
      '/tracks/search',
      params,
      60_000,
    );
    return {
      items: records
        .map(mapAudiusTrack)
        .filter((song) => song.id && song.streamable),
      nextOffset: offset + records.length,
      hasMore: records.length === limit,
    };
  }
  if (kind === 'artists') {
    const records = await audiusGet<AudiusUser[]>(
      '/users/search',
      params,
      60_000,
    );
    return {
      items: records.map(mapAudiusArtist).filter((artist) => artist.id),
      nextOffset: offset + records.length,
      hasMore: records.length === limit,
    };
  }
  const records = await audiusGet<AudiusPlaylist[]>(
    '/playlists/search',
    params,
    60_000,
  );
  return {
    items: records.map(mapAudiusPlaylist).filter((playlist) => playlist.id),
    nextOffset: offset + records.length,
    hasMore: records.length === limit,
  };
}

export async function getAudiusRelatedArtists(artistId: string, limit = 12) {
  const records = await audiusGet<AudiusUser[]>(
    `/users/${encodeURIComponent(artistId)}/related`,
    { limit },
    10 * 60_000,
  );
  return records
    .map(mapAudiusArtist)
    .filter(
      (artist) => artist.id && artist.id !== artistId && artist.trackCount > 0,
    );
}

function eventPermalink(event: AudiusEvent, track?: CrimsonSong) {
  if (event.permalink)
    return event.permalink.startsWith('http')
      ? event.permalink
      : `https://audius.co${event.permalink}`;
  if (track?.permalink)
    return track.permalink.startsWith('http')
      ? track.permalink
      : `https://audius.co${track.permalink}`;
  return 'https://audius.co/explore';
}

function mapAudiusEvent(
  event: AudiusEvent,
  users: Map<string, CrimsonArtist>,
  tracks: Map<string, CrimsonSong>,
  entryCounts: Record<string, number>,
): CrimsonEvent {
  const host = users.get(String(event.user_id || ''));
  const track = tracks.get(String(event.entity_id || ''));
  return {
    id: String(event.event_id || ''),
    type: event.event_type || 'remix_contest',
    title: String(event.event_data?.title || track?.title || 'Audius event'),
    description: String(event.event_data?.description || ''),
    prizeInfo: String(event.event_data?.prize_info || ''),
    endDate: String(event.end_date || ''),
    createdAt: String(event.created_at || ''),
    hostId: String(event.user_id || ''),
    hostName: host?.name || track?.creator || 'Audius creator',
    hostImage: host?.imageSmall || '',
    entityId: String(event.entity_id || ''),
    image: String(
      event.event_data?.cover_photo_url ||
        track?.image ||
        host?.aboutImage ||
        host?.image ||
        '',
    ),
    permalink: eventPermalink(event, track),
    entryCount: Number(entryCounts[String(event.entity_id || '')] || 0),
    track,
  };
}

export async function getAudiusEvents(limit = 24, searchQuery = '') {
  const payload = await audiusGetPayload<AudiusEventsResponse>(
    '/events/remix-contests',
    {
      limit: Math.max(limit, 30),
      status: 'active',
    },
    5 * 60_000,
  );
  const users = new Map(
    (payload.related?.users || []).map((item) => {
      const artist = mapAudiusArtist(item);
      return [artist.id, artist];
    }),
  );
  const tracks = new Map(
    (payload.related?.tracks || []).map((item) => {
      const track = mapAudiusTrack(item);
      return [track.id, track];
    }),
  );
  const normalized = searchQuery.trim().toLowerCase();
  return (payload.data || [])
    .map((event) =>
      mapAudiusEvent(event, users, tracks, payload.related?.entry_counts || {}),
    )
    .filter(
      (event) =>
        event.id &&
        (!normalized ||
          `${event.title} ${event.description} ${event.hostName}`
            .toLowerCase()
            .includes(normalized)),
    )
    .slice(0, limit);
}

export async function getAudiusEvent(eventId: string) {
  const payload = await audiusGetPayload<AudiusEventsResponse>(
    '/events',
    { id: eventId },
    5 * 60_000,
  );
  const event = payload.data?.[0];
  if (!event) throw new Error('Event was not found.');
  const users = new Map(
    (payload.related?.users || []).map((item) => {
      const artist = mapAudiusArtist(item);
      return [artist.id, artist];
    }),
  );
  const tracks = new Map(
    (payload.related?.tracks || []).map((item) => {
      const track = mapAudiusTrack(item);
      return [track.id, track];
    }),
  );
  let mapped = mapAudiusEvent(
    event,
    users,
    tracks,
    payload.related?.entry_counts || {},
  );
  if (!mapped.track && mapped.entityId) {
    const track = await getAudiusTrack(mapped.entityId).catch(() => undefined);
    if (track)
      mapped = {
        ...mapped,
        track,
        image: mapped.image || track.image,
        permalink: eventPermalink(event, track),
        hostName:
          mapped.hostName === 'Audius creator'
            ? track.creator
            : mapped.hostName,
      };
  }
  return mapped;
}

export async function getAudiusPlaylist(playlistId: string) {
  const records = await audiusGet<AudiusPlaylist[]>(
    `/playlists/${encodeURIComponent(playlistId)}`,
    {},
    5 * 60_000,
  );
  const record = Array.isArray(records) ? records[0] : records;
  if (!record) throw new Error('Playlist was not found.');
  return mapAudiusPlaylist(record);
}

export async function getAudiusPlaylistTracks(playlistId: string) {
  // This endpoint returns the full ordered collection; its documented contract has
  // no limit/offset. Do not pass an invented 100-track cap or paginate it blindly.
  const records = await audiusGet<AudiusTrack[]>(
    `/playlists/${encodeURIComponent(playlistId)}/tracks`,
    {},
    5 * 60_000,
  );
  return records
    .map(mapAudiusTrack)
    .filter((track) => track.id && track.streamable);
}

export async function getAudiusGenreCatalog(genre: string) {
  const [songs, search] = await Promise.all([
    getTrendingAudiusTracks(20, genre),
    searchAudius(genre, 10),
  ]);
  return { songs, playlists: search.playlists };
}

export function audiusStreamUrl(trackId: string) {
  const url = new URL(
    `${API_BASE}/tracks/${encodeURIComponent(trackId)}/stream`,
  );
  const uid = getCurrentAudiusUserId();
  if (uid) url.searchParams.set('user_id', uid);
  return url.toString();
}

export async function resolveAudiusStreamUrl(trackId: string) {
  const fallback = audiusStreamUrl(trackId);
  try {
    return await resolvedStreamCache.get(
      `${getCurrentAudiusUserId()}:${trackId}`,
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7_000);
        try {
          // Ask for the URL as JSON: don't open a second audio transfer just to
          // discover the CDN URL (some native fetch stacks buffer range probes).
          const lookup = new URL(fallback);
          lookup.searchParams.set('no_redirect', 'true');
          return await fetchAudius(
            lookup.toString(),
            { signal: controller.signal },
            async (response) => {
              if (!response.ok)
                throw new Error(`Audius stream failed (${response.status}).`);
              const payload = (await response.json()) as { data?: unknown };
              if (
                typeof payload.data !== 'string' ||
                new URL(payload.data).protocol !== 'https:'
              ) {
                throw new Error('Audius did not return a valid stream URL.');
              }
              return payload.data;
            },
          );
        } finally {
          clearTimeout(timeout);
        }
      },
      10 * 60_000,
    );
  } catch {
    return fallback;
  }
}

export function clearAudiusCaches() {
  responseCache.clear();
  resolvedStreamCache.clear();
}
