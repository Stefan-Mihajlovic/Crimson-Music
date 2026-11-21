import type { CrimsonSong } from '@/types/music';

export type RecommendationFeedback = {
  updatedAt: number;
  liked: Record<string, { artistId: string; genre: string }>;
  hiddenSongs: string[];
  hiddenArtists: string[];
};
export type FeedbackAction = 'more' | 'hide-song' | 'hide-artist';
export const EMPTY_FEEDBACK: RecommendationFeedback = { updatedAt: 0, liked: {}, hiddenSongs: [], hiddenArtists: [] };
export function allowsRecommendation(song: Pick<CrimsonSong, 'id' | 'artistId'>, feedback = EMPTY_FEEDBACK) {
  return !feedback.hiddenSongs.includes(song.id) && !feedback.hiddenArtists.includes(song.artistId);
}
export function recommendationAffinity(song: Pick<CrimsonSong, 'id' | 'artistId' | 'genre'>, feedback = EMPTY_FEEDBACK) {
  if (feedback.liked[song.id]) return { score: 10, reason: 'You asked for more like this' };
  const likes = Object.values(feedback.liked);
  if (song.artistId && likes.some((item) => item.artistId === song.artistId)) return { score: 6, reason: 'From an artist you asked to hear more of' };
  if (song.genre && likes.some((item) => item.genre.toLowerCase() === song.genre.toLowerCase())) return { score: 3, reason: `More ${song.genre}, based on your feedback` };
  return { score: 0, reason: '' };
}
export function changeRecommendationFeedback(current: RecommendationFeedback, song: Pick<CrimsonSong, 'id' | 'artistId' | 'genre'>, action: FeedbackAction): RecommendationFeedback {
  const next = { ...current, updatedAt: Math.max(Date.now(), current.updatedAt + 1), liked: { ...current.liked } };
  const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
  if (action === 'more') {
    if (next.liked[song.id]) delete next.liked[song.id];
    else { next.liked[song.id] = { artistId: song.artistId, genre: song.genre }; next.hiddenSongs = next.hiddenSongs.filter((id) => id !== song.id); next.hiddenArtists = next.hiddenArtists.filter((id) => id !== song.artistId); }
  } else if (action === 'hide-song') {
    next.hiddenSongs = toggle(current.hiddenSongs, song.id);
    if (next.hiddenSongs.includes(song.id)) delete next.liked[song.id];
  } else if (song.artistId) next.hiddenArtists = toggle(current.hiddenArtists, song.artistId);
  return next;
}
