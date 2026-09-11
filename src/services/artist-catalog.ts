import {
  getAudiusArtist,
  getAudiusArtistCollections,
  getAudiusArtistTracksPage,
  getAudiusRelatedArtists,
} from '@/services/audius';
import type { ArtistDetail, CrimsonSong } from '@/types/music';
export type ArtistCatalog = ArtistDetail & {
  latestRelease: CrimsonSong | null;
};
export async function loadArtistCatalog(id: string): Promise<ArtistCatalog> {
  const [artist, latest, popular, collections, relatedArtists] =
    await Promise.all([
      getAudiusArtist(id),
      getAudiusArtistTracksPage(id, 10, 0, 'date'),
      getAudiusArtistTracksPage(id, 10, 0, 'plays'),
      getAudiusArtistCollections(id).catch(() => []),
      getAudiusRelatedArtists(id, 12).catch(() => []),
    ]);
  return {
    artist,
    songs: popular.items,
    latestRelease: latest.items[0] || null,
    appearsOn: collections,
    relatedArtists,
    hasMoreTracks: popular.hasMore,
  };
}
