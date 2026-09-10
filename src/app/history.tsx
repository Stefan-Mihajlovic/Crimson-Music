import { Stack, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BouncyPressable from '@/components/bouncy-pressable';
import NowPlayingArtwork from '@/components/now-playing-artwork';
import { useAuth } from '@/providers/auth-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref } from '@/services/action-sheet';
import {
  ListeningHistoryCursor,
  ListeningHistoryEntry,
  loadListeningHistoryPage,
} from '@/services/music';

const historyPageSize = 15;
const historyLimit = 50;

export default function ListeningHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const uid = user?.uid;
  const { playSong } = usePlayer();
  const { colors } = useAppSettings();
  const [entries, setEntries] = useState<ListeningHistoryEntry[]>([]);
  const [cursor, setCursor] = useState<ListeningHistoryCursor | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    loadListeningHistoryPage(uid, null, historyPageSize)
      .then((page) => {
        if (!active) return;
        setEntries(page.items);
        setCursor(page.cursor);
        setHasMore(page.hasMore && page.items.length < historyLimit);
      })
      .catch(() => {
        if (active) Alert.alert('History unavailable', 'Could not load your listening history.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uid]);

  const loadMore = useCallback(() => {
    if (!uid || loading || loadingMore || !hasMore || entries.length >= historyLimit) return;
    const remaining = historyLimit - entries.length;
    setLoadingMore(true);
    loadListeningHistoryPage(uid, cursor, Math.min(historyPageSize, remaining))
      .then((page) => {
        setEntries((current) => [...current, ...page.items].slice(0, historyLimit));
        setCursor(page.cursor);
        setHasMore(page.hasMore && entries.length + page.items.length < historyLimit);
      })
      .catch(() => Alert.alert('Could not load more history', 'Please try again.'))
      .finally(() => setLoadingMore(false));
  }, [cursor, entries.length, hasMore, loading, loadingMore, uid]);

  const queue = entries.map((entry) => entry.song);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Listening History' }} />
      {loading ? (
        <ActivityIndicator color={colors.accent} size="large" style={styles.loader} />
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 130 }]}
          data={entries}
          initialNumToRender={15}
          keyExtractor={(entry) => entry.id}
          ListHeaderComponent={(
            <View style={styles.intro}>
              <Text style={[styles.introTitle, { color: colors.text }]}>Recently played</Text>
              <Text style={[styles.introSubtitle, { color: colors.secondaryText }]}>Your latest 50 unique tracks.</Text>
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <SymbolView name="clock.arrow.circlepath" size={34} tintColor={colors.accent} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing here yet</Text>
              <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>Songs you play will appear here.</Text>
            </View>
          )}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} style={styles.footerLoader} /> : null}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
            <HistoryRow
              entry={item}
              onPress={() => playSong(item.song, queue, 'Listening History')}
              onMenuPress={() => router.push(actionSheetHref({
                type: 'song',
                id: item.song.id,
                title: item.song.title,
                subtitle: item.song.creator,
                image: item.song.imageSmall || item.song.image,
                artistId: item.song.artistId,
                source: item.song.source,
              }))}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function HistoryRow({
  entry,
  onMenuPress,
  onPress,
}: {
  entry: ListeningHistoryEntry;
  onMenuPress: () => void;
  onPress: () => void;
}) {
  const { currentSong } = usePlayer();
  const { colors, reduceMotion } = useAppSettings();
  const active = currentSong?.id === entry.song.id;
  return (
    <Pressable
      accessibilityLabel={`Play ${entry.song.title} by ${entry.song.creator}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        active && { backgroundColor: colors.accentSoft },
        pressed && { backgroundColor: colors.accentSoft },
        pressed && !reduceMotion && styles.rowPressed,
      ]}>
      <NowPlayingArtwork borderRadius={10} size={52} song={entry.song} />
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: active ? colors.accent : colors.text }]}>{entry.song.title}</Text>
        <Text numberOfLines={1} style={[styles.rowSubtitle, { color: colors.secondaryText }]}>
          {entry.song.creator} · {formatPlayedAt(entry.playedAt)}
        </Text>
      </View>
      <BouncyPressable
        accessibilityLabel={`More options for ${entry.song.title}`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={(event) => {
          event.stopPropagation();
          onMenuPress();
        }}
        style={styles.menuButton}>
        <SymbolView name="ellipsis" size={20} tintColor={colors.secondaryText} weight="semibold" />
      </BouncyPressable>
    </Pressable>
  );
}

function formatPlayedAt(date: Date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const playedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round((today.getTime() - playedDay.getTime()) / 86_400_000);
  if (daysAgo === 0) return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (daysAgo === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loader: { flex: 1 },
  content: { paddingHorizontal: 12 },
  intro: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 16 },
  introTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  introSubtitle: { marginTop: 4, fontSize: 14 },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 10, borderRadius: 17 },
  rowPressed: { transform: [{ scale: 0.99 }] },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSubtitle: { marginTop: 3, fontSize: 13 },
  menuButton: { width: 42, height: 42, borderRadius: 21 },
  empty: { alignItems: 'center', paddingTop: 90 },
  emptyTitle: { marginTop: 14, fontSize: 20, fontWeight: '700' },
  emptyBody: { marginTop: 5, fontSize: 14 },
  footerLoader: { paddingVertical: 24 },
});
