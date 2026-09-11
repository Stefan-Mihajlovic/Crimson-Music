import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DetailSongRow from '@/components/detail-song-row';
import LoadFailure from '@/components/load-failure';
import CollectionTools, {
  collectionSongs,
  type SongSort,
} from '@/components/collection-tools';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref } from '@/services/action-sheet';
import { getAudiusArtistTracksPage } from '@/services/audius';
import type { CrimsonSong } from '@/types/music';

export default function ArtistTracksScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { playSong } = usePlayer();
  const { colors } = useAppSettings();
  const [songs, setSongs] = useState<CrimsonSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SongSort>('original');
  const request = useRef(0);
  const offset = useRef(0);
  const pending = useRef(false);
  const load = useCallback(
    async (reset: boolean) => {
      if (!id || (pending.current && !reset)) return;
      const token = reset ? ++request.current : request.current;
      pending.current = true;
      setError(false);
      if (reset) {
        setLoading(true);
        setSongs([]);
        offset.current = 0;
      } else setLoadingMore(true);
      try {
        const page = await getAudiusArtistTracksPage(
          String(id),
          30,
          reset ? 0 : offset.current,
          sort === 'title' || sort === 'artist' ? sort : 'date',
          query.trim(),
        );
        if (request.current !== token) return;
        offset.current = page.nextOffset;
        setSongs((current) =>
          Array.from(
            new Map(
              [...(reset ? [] : current), ...page.items].map((song) => [
                song.id,
                song,
              ]),
            ).values(),
          ),
        );
        setHasMore(page.hasMore);
      } catch {
        if (request.current === token) setError(true);
      } finally {
        if (request.current === token) {
          pending.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [id, query, sort],
  );
  useEffect(() => {
    pending.current = true;
    const timer = setTimeout(() => void load(true), query.trim() ? 300 : 0);
    return () => {
      clearTimeout(timer);
      request.current += 1;
      pending.current = false;
    };
  }, [load, query]);
  const visible = useMemo(
    () => collectionSongs(songs, query, sort),
    [songs, query, sort],
  );
  const shuffle = () => {
    const first = visible[Math.floor(Math.random() * visible.length)];
    if (first) playSong(first, visible, String(name || 'Artist'), '', true);
  };
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: `${name || 'Artist'} · Tracks` }} />
      <FlatList
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
        data={visible}
        keyExtractor={(song) => song.id}
        ListHeaderComponent={
          <CollectionTools
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={setSort}
            onShuffle={shuffle}
            disabled={!visible.length}
          />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : error ? (
            <LoadFailure
              title="Tracks unavailable"
              onRetry={() => void load(true)}
            />
          ) : (
            <Text style={[styles.empty, { color: colors.secondaryText }]}>
              {query ? 'No tracks match your search.' : 'No tracks available.'}
            </Text>
          )
        }
        ListFooterComponent={
          error && songs.length ? (
            <LoadFailure
              title="Could not load more tracks"
              onRetry={() => void load(false)}
            />
          ) : loadingMore ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : null
        }
        onEndReached={() => {
          if (hasMore && !loading && !error) void load(false);
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 12 }}>
            <DetailSongRow
              song={item}
              onPress={() => playSong(item, visible, String(name || 'Artist'))}
              onLongPress={() =>
                router.push(
                  actionSheetHref({
                    type: 'song',
                    id: item.id,
                    title: item.title,
                    subtitle: item.creator,
                    image: item.imageSmall || item.image,
                    artistId: item.artistId,
                  }),
                )
              }
            />
          </View>
        )}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { padding: 24, fontSize: 15, textAlign: 'center' },
  footer: { paddingVertical: 24 },
});
