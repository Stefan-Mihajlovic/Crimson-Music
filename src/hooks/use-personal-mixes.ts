import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { loadBookmarkedPersonalMixes, loadPersonalMixes, personalMixPeriod, type PersonalMix } from '@/services/personal-mixes';
import { subscribeToLibraryRefresh } from '@/services/navigation-events';

export function usePersonalMixes() {
  return useMixes(false);
}

export function useBookmarkedPersonalMixes() {
  return useMixes(true);
}

function useMixes(bookmarkedOnly: boolean) {
  const { user } = useAuth();
  const { isOffline } = useNetwork();
  const [mixes, setMixes] = useState<PersonalMix[]>([]);
  const [resolvedKey, setResolvedKey] = useState('');
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const uid = user?.uid;
  const categories = JSON.stringify(user?.FavoriteCategories || []);
  const style = user?.RecommendationStyle;
  const requestKey = JSON.stringify([uid, categories, style, isOffline, revision, bookmarkedOnly]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    const unsubscribe = subscribeToLibraryRefresh(refresh);
    return () => { subscription.remove(); unsubscribe(); };
  }, [refresh]);
  useEffect(() => {
    const timer = setTimeout(refresh, personalMixPeriod('daily').refreshAt - Date.now() + 1_000);
    return () => clearTimeout(timer);
  }, [refresh, revision]);
  useEffect(() => {
    let active = true;
    const load = bookmarkedOnly ? loadBookmarkedPersonalMixes : loadPersonalMixes;
    void load(uid, { favoriteCategories: JSON.parse(categories) as string[], recommendationStyle: style || 'balanced' }, { offlineOnly: isOffline })
      .then((result) => { if (active) { setMixes(result); setError(!bookmarkedOnly && !result.length); } })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setResolvedKey(requestKey); });
    return () => { active = false; };
  }, [uid, categories, style, isOffline, requestKey, bookmarkedOnly]);
  return { mixes: mixes.filter((mix) => mix.owner === (uid || 'guest')), loading: resolvedKey !== requestKey, error: resolvedKey === requestKey && error, refresh };
}
