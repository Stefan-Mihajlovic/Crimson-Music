import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAccountDeleted, registerAccountCleanup } from '@/services/account-lifecycle';
import { getAudiusSessionRevision, getCurrentAudiusUserId } from '@/services/audius-session';
import { changeRecommendationFeedback, EMPTY_FEEDBACK, type FeedbackAction, type RecommendationFeedback } from '@/services/recommendation-feedback-model';
import type { CrimsonSong } from '@/types/music';

const key = (uid: string) => `crimson.recommendation-feedback.v1:${encodeURIComponent(uid)}`;
const values = new Map<string, RecommendationFeedback>();
const reads = new Map<string, Promise<RecommendationFeedback>>();
const writes = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
export const subscribeRecommendationFeedback = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getRecommendationFeedback = (uid?: string) => uid ? values.get(uid) || EMPTY_FEEDBACK : EMPTY_FEEDBACK;
export function readRecommendationFeedback(uid?: string): Promise<RecommendationFeedback> {
  if (!uid || isAccountDeleted(uid)) return Promise.resolve(EMPTY_FEEDBACK);
  if (values.has(uid)) return Promise.resolve(values.get(uid)!);
  const pending = reads.get(uid);
  if (pending) return pending;
  const read = AsyncStorage.getItem(key(uid)).then((raw) => {
    let next = EMPTY_FEEDBACK;
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      const ids = (value: unknown): string[] => Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
      if (parsed && typeof parsed === 'object') next = {
        updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
        hiddenSongs: ids(parsed.hiddenSongs), hiddenArtists: ids(parsed.hiddenArtists),
        liked: Object.fromEntries(Object.entries(parsed.liked || {}).filter(([, value]) => value && typeof value === 'object' && typeof (value as { artistId?: unknown }).artistId === 'string' && typeof (value as { genre?: unknown }).genre === 'string')) as RecommendationFeedback['liked'],
      };
    } catch { /* Recover invalid local preferences without affecting playback. */ }
    if (!isAccountDeleted(uid)) { values.set(uid, next); emit(); }
    return next;
  }).finally(() => { reads.delete(uid); });
  reads.set(uid, read);
  return read;
}
export function saveRecommendationFeedback(uid: string, song: CrimsonSong, action: FeedbackAction) {
  const revision = getAudiusSessionRevision();
  const valid = () => !isAccountDeleted(uid) && getCurrentAudiusUserId() === uid && getAudiusSessionRevision() === revision;
  const pending = (writes.get(uid) || Promise.resolve()).catch(() => undefined).then(async () => {
    const current = await readRecommendationFeedback(uid);
    if (!valid()) throw new Error('Your account changed. Reopen this menu and try again.');
    const next = changeRecommendationFeedback(current, song, action);
    await AsyncStorage.setItem(key(uid), JSON.stringify(next));
    if (valid()) { values.set(uid, next); emit(); }
  });
  writes.set(uid, pending);
  void pending.finally(() => { if (writes.get(uid) === pending) writes.delete(uid); }).catch(() => undefined);
  return pending;
}
registerAccountCleanup(async (uid) => {
  await Promise.allSettled([writes.get(uid), reads.get(uid)]);
  values.delete(uid);
  await AsyncStorage.removeItem(key(uid));
  emit();
});
