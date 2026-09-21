import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { NavigationProp, ParamListBase } from 'expo-router/react-navigation';

import { useAuth } from '@/providers/auth-provider';
import { useDownloads } from '@/providers/download-provider';
import { useNetwork } from '@/providers/network-provider';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { loadFavoriteSongs } from '@/services/music';
import { Alert } from '@/services/alert';
import { nextWidgetPlayRequest, requestWidgetPlayerPresentation, widgetNavigationState, type WidgetDestination } from '@/services/widget-navigation';

const mixIds = new Set(['daily', 'weekly', 'monthly', 'release-radar', 'rediscover', 'hidden-gems']);

/** A single cold/warm-launch handoff for both native widget implementations. */
export default function WidgetActionScreen() {
  const { action = 'resume', kind } = useLocalSearchParams<{ action?: string; kind?: string }>();
  const { user, ready: authReady, onboardingComplete } = useAuth();
  const player = usePlayer();
  const { playing } = usePlayerStatus();
  const { isOffline } = useNetwork();
  const { ready: downloadsReady, isDownloaded, songsForCollection } = useDownloads();
  const { colors } = useAppSettings();
  const router = useRouter();
  const navigation = useNavigation<NavigationProp<ParamListBase>>('/');
  const handled = useRef('');
  const revision = useRef(0);
  useEffect(() => () => { revision.current += 1; }, [action, kind, user?.uid]);
  useEffect(() => {
    if (!authReady || (user && !player.ready)) return;
    if (action === 'favorites' && isOffline && !downloadsReady) return;
    const request = `${user?.uid || ''}:${action}:${kind || ''}`;
    if (handled.current === request) return;
    handled.current = request;
    if (!user || !onboardingComplete) { router.replace('/'); return; }
    const finish = (destination?: WidgetDestination, expanded = false) => {
      navigation.dispatch({ type: 'RESET', payload: widgetNavigationState(navigation.getState(), destination) });
      requestWidgetPlayerPresentation(expanded);
    };

    if (action === 'mix') {
      const id = kind && mixIds.has(kind) ? kind : 'daily';
      finish({ group: '(home)', screen: 'mix', params: { id, play: '1', playRequest: nextWidgetPlayRequest() } });
      return;
    }
    if (action === 'local') { finish({ group: '(library)', screen: 'local-music' }); return; }
    if (action === 'library') { finish({ group: '(library)', screen: 'library' }); return; }
    if (action === 'history') { finish({ group: '(home)', screen: 'history' }); return; }
    if (action === 'favorites') {
      const active = revision.current;
      void loadFavoriteSongs(user.uid, { offlineOnly: isOffline }).then((songs) => {
        if (revision.current !== active) return;
        const available = isOffline ? songs.filter((song) => song.source === 'local' || isDownloaded(song.id)) : songs;
        const queue = available.length || !isOffline ? available : songsForCollection('favorites');
        if (queue.length) player.playSong(queue[0], queue, 'Favorites', 'favorites');
      }).catch(() => {
        if (revision.current === active) Alert.alert('Favorites unavailable', 'Open Favorites to try again.');
      }).finally(() => {
        if (revision.current === active) finish({ group: '(library)', screen: 'favorites' });
      });
      return;
    }
    if (player.currentSong) {
      if (action === 'next') player.playNext();
      else if (action === 'previous') player.playPrevious();
      else if (action === 'pause') {
        if (playing || player.playbackState === 'loading' || player.playbackState === 'buffering') player.togglePlay();
      } else if (!playing && player.playbackState !== 'loading' && player.playbackState !== 'buffering') player.togglePlay();
      finish(undefined, true);
    } else finish({ group: '(home)', screen: 'index' });
  }, [action, authReady, downloadsReady, isDownloaded, isOffline, kind, navigation, onboardingComplete, player, playing, router, songsForCollection, user]);

  return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.accent} accessibilityLabel="Opening your music" /></View>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
