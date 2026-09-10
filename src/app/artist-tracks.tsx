import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DetailSongRow from '@/components/detail-song-row';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref } from '@/services/action-sheet';
import { CrimsonSong, loadArtistTracksPage } from '@/services/music';

const pageSize = 30;

export default function ArtistTracksScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playSong } = usePlayer();
  const { colors } = useAppSettings();
  const [songs, setSongs] = useState<CrimsonSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadPage = useCallback(async (offset: number) => {
    if (!id) return;
    const next = await loadArtistTracksPage(String(id), offset, pageSize);
    setSongs((current) => offset === 0
      ? next
      : Array.from(new Map([...current, ...next].map((song) => [song.id, song])).values()));
    setHasMore(next.length === pageSize);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadArtistTracksPage(String(id), 0, pageSize)
      .then((next) => {
        setSongs(next);
        setHasMore(next.length === pageSize);
      })
      .catch(() => Alert.alert('Tracks unavailable', 'Could not load this artist’s tracks.'))
      .finally(() => setLoading(false));
  }, [id]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadPage(songs.length)
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  }, [hasMore, loadPage, loading, loadingMore, songs.length]);

  if (loading) {
    return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: `${name || 'Artist'} · Tracks` }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 120 }}
        data={songs}
        initialNumToRender={12}
        keyExtractor={(song) => song.id}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.secondaryText }]}>No tracks available.</Text>}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} style={styles.footer} /> : null}
        onEndReached={loadMore}
        onEndReachedThreshold={0.65}
        renderItem={({ item }) => (
          <DetailSongRow
            song={item}
            onPress={() => playSong(item, songs, String(name || 'Artist'))}
            onLongPress={() => router.push(actionSheetHref({ type: 'song', id: item.id, title: item.title, subtitle: item.creator, image: item.imageSmall || item.image, artistId: item.artistId }))}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, fontSize: 15, textAlign: 'center' },
  footer: { paddingVertical: 24 },
});
