import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { getRecommendationFeedback, readRecommendationFeedback, subscribeRecommendationFeedback } from '@/services/recommendation-feedback';
export function useRecommendationFeedback() {
  const { user } = useAuth();
  const uid = user?.uid;
  const feedback = useSyncExternalStore(subscribeRecommendationFeedback, () => getRecommendationFeedback(uid), () => getRecommendationFeedback());
  useEffect(() => { void readRecommendationFeedback(uid).catch(() => undefined); }, [uid]);
  return feedback;
}
