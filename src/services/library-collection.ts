import type { LocalListeningEvent } from '@/services/music';
import type {
  CrimsonArtist,
  CrimsonPlaylist,
  LibraryFeed,
} from '@/types/music';

export type LibraryCollectionItem =
  | { key: 'favorites'; kind: 'favorites' }
  | { key: string; kind: 'playlist'; playlist: CrimsonPlaylist; owned: boolean }
  | { key: string; kind: 'artist'; artist: CrimsonArtist };

/** Local playback determines recency; untouched items retain their library order. */
export function buildLibraryCollection(
  feed: LibraryFeed,
  events: readonly LocalListeningEvent[],
): LibraryCollectionItem[] {
  const latestPlaylists = new Map<string, number>();
  const latestArtists = new Map<string, number>();
  for (const event of events) {
    if (
      event.type !== 'play' ||
      !Number.isFinite(event.occurredAt) ||
      event.occurredAt <= 0
    )
      continue;
    if (event.playlistId) {
      latestPlaylists.set(
        event.playlistId,
        Math.max(latestPlaylists.get(event.playlistId) || 0, event.occurredAt),
      );
    }
    const artistId =
      typeof event.snapshot?.artistId === 'string'
        ? event.snapshot.artistId
        : '';
    if (artistId)
      latestArtists.set(
        artistId,
        Math.max(latestArtists.get(artistId) || 0, event.occurredAt),
      );
  }

  const items: {
    item: LibraryCollectionItem;
    playedAt: number;
    order: number;
  }[] = [];
  const seen = new Set<string>();
  const addPlaylist = (playlist: CrimsonPlaylist, owned: boolean) => {
    const key = `playlist:${playlist.source}:${playlist.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      item: { key, kind: 'playlist', playlist, owned },
      playedAt: latestPlaylists.get(playlist.id) || 0,
      order: items.length,
    });
  };
  feed.playlists.forEach((playlist) => addPlaylist(playlist, true));
  feed.likedPlaylists.forEach((playlist) =>
    addPlaylist(playlist, Boolean(playlist.owned)),
  );
  feed.followedArtists.forEach((artist) => {
    const key = `artist:${artist.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      item: { key, kind: 'artist', artist },
      playedAt: latestArtists.get(artist.id) || 0,
      order: items.length,
    });
  });
  items.sort(
    (first, second) =>
      second.playedAt - first.playedAt || first.order - second.order,
  );
  return [
    { key: 'favorites', kind: 'favorites' },
    ...items.map(({ item }) => item),
  ];
}

export type LibraryFilter = 'all' | 'playlists' | 'artists' | 'downloaded';
export type LibrarySort = 'recent' | 'title';
export function filterLibraryCollection(
  items: readonly LibraryCollectionItem[],
  query: string,
  options: {
    filter?: LibraryFilter;
    sort?: LibrarySort;
    isOffline?: (item: LibraryCollectionItem) => boolean;
  } = {},
): LibraryCollectionItem[] {
  const normalized = query.trim().toLowerCase();
  const matching = items.filter((item) => {
    if (item.kind !== 'favorites') {
      if (options.filter === 'artists' && item.kind !== 'artist') return false;
      if (options.filter === 'playlists' && item.kind !== 'playlist')
        return false;
    }
    if (options.filter === 'downloaded' && !options.isOffline?.(item))
      return false;
    if (!normalized) return true;
    if (item.kind === 'favorites') return 'favorites'.includes(normalized);
    if (item.kind === 'artist')
      return `${item.artist.name} ${item.artist.handle}`
        .toLowerCase()
        .includes(normalized);
    return `${item.playlist.title} ${item.playlist.artists}`
      .toLowerCase()
      .includes(normalized);
  });
  if (options.sort === 'title')
    matching.sort((a, b) => {
      if (a.kind === 'favorites') return -1;
      if (b.kind === 'favorites') return 1;
      const title = (item: LibraryCollectionItem) =>
        item.kind === 'artist'
          ? item.artist.name
          : item.kind === 'playlist'
            ? item.playlist.title
            : 'Favorites';
      return title(a).localeCompare(title(b));
    });
  return matching;
}
