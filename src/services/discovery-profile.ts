import type { RecommendationStyle } from '@/services/auth';
import type { CrimsonSong } from '@/types/music';

export type DiscoveryProfile = {
  favoriteCategories?: string[];
  recommendationStyle?: RecommendationStyle;
};
const genreNames: Record<string, string> = {
  electronic: 'Electronic',
  'hip-hop-rap': 'Hip-Hop/Rap',
  pop: 'Pop',
  'r-b-soul': 'R&B/Soul',
  rock: 'Rock',
  ambient: 'Ambient',
  jazz: 'Jazz',
  classical: 'Classical',
  reggae: 'Reggae',
  podcasts: 'Podcasts',
};
export function preferredGenres(profile: DiscoveryProfile) {
  return [
    ...new Set(
      (profile.favoriteCategories || []).map(
        (name) => genreNames[name.toLowerCase()] || name,
      ),
    ),
  ]
    .filter((name) => name !== 'Events')
    .slice(0, 10);
}
export function rankDiscoveryTracks(
  songs: CrimsonSong[],
  profile: DiscoveryProfile,
  recentlyPlayed: Set<string>,
  skipped: Set<string>,
  followed: Set<string>,
  seed: number,
) {
  const genres = preferredGenres(profile).map((name) => name.toLowerCase());
  const style = profile.recommendationStyle || 'balanced';
  const noise = (id: string) => {
    let value = seed | 0;
    for (const c of id) value = Math.imul(value ^ c.charCodeAt(0), 16777619);
    return (value >>> 0) / 4294967296;
  };
  return [...new Map(songs.map((song) => [song.id, song])).values()]
    .filter((song) => song.streamable)
    .map((song) => {
      const genreMatch = genres.includes(song.genre.toLowerCase());
      const familiar = followed.has(song.artistId);
      const reason = familiar
        ? `From ${song.creator}, who you follow`
        : genreMatch
          ? `From your ${song.genre} preferences`
          : 'Discover something different';
      let score =
        noise(song.id) * 3 +
        (genreMatch ? 4 : 0) -
        (skipped.has(song.id) ? 12 : 0);
      score += familiar
        ? style === 'familiar'
          ? 8
          : style === 'surprise'
            ? -2
            : 2
        : style === 'surprise'
          ? 5
          : 0;
      score -= recentlyPlayed.has(song.id) ? (style === 'familiar' ? 1 : 7) : 0;
      if (style === 'underground')
        score += 8 / (1 + Math.log10(1 + Math.max(0, song.playCount)));
      return { song, score, reason };
    })
    .sort((a, b) => b.score - a.score);
}
