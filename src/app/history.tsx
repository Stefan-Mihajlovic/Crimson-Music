import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BouncyPressable from '@/components/bouncy-pressable';
import LiquidSearchField from '@/components/liquid-search-field';
import NowPlayingArtwork from '@/components/now-playing-artwork';
import { useAuth } from '@/providers/auth-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref } from '@/services/action-sheet';
import { calendarDayLabel } from '@/services/date-groups';
import { confirmAction } from '@/services/confirm-action';
import { clearLocalListeningHistory, ListeningHistoryCursor, ListeningHistoryEntry, loadListeningHistoryPage, subscribeLocalListeningHistory } from '@/services/music';

const pageSize = 40;
export default function ListeningHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const uid = user?.uid;
  const { playSong } = usePlayer();
  const { colors } = useAppSettings();
  const [entries, setEntries] = useState<ListeningHistoryEntry[]>([]);
  const [cursor, setCursor] = useState<ListeningHistoryCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const revision = useRef(0);
  const loadingMoreRef = useRef(false);
  const clearingRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);
  const refresh = useCallback(() => {
    const request = ++revision.current;
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setLoading(true);
    setError(null);
    if (!uid) { setEntries([]); setLoading(false); return; }
    void loadListeningHistoryPage(uid, null, pageSize, { mode: 'recent', query: search }).then((page) => {
      if (request !== revision.current) return;
      setEntries(page.items); setCursor(page.cursor); setHasMore(page.hasMore);
    }).catch(() => {
      if (request === revision.current) setError('Could not load listening history. Your saved history has not been cleared.');
    }).finally(() => { if (request === revision.current) setLoading(false); });
  }, [search, uid]);
  useFocusEffect(useCallback(() => {
    refresh();
    const unsubscribe = uid ? subscribeLocalListeningHistory(uid, refresh) : undefined;
    return () => { revision.current += 1; unsubscribe?.(); };
  }, [refresh, uid]));
  const loadMore = useCallback(() => {
    if (!uid || loading || loadingMoreRef.current || !hasMore) return;
    const request = revision.current;
    loadingMoreRef.current = true; setLoadingMore(true); setError(null);
    void loadListeningHistoryPage(uid, cursor, pageSize, { mode: 'recent', query: search }).then((page) => {
      if (request !== revision.current) return;
      setEntries((current) => [...new Map([...current, ...page.items].map((entry) => [entry.id, entry])).values()]);
      setCursor(page.cursor); setHasMore(page.hasMore);
    }).catch(() => { if (request === revision.current) setError('Could not load older history. Try again.'); })
      .finally(() => { if (request === revision.current) { loadingMoreRef.current = false; setLoadingMore(false); } });
  }, [cursor, hasMore, loading, search, uid]);
  const clearHistory = async () => {
    if (!uid || clearingRef.current) return;
    if (!await confirmAction('Clear listening history?', 'Remove listening history and recap statistics stored for this Audius account on this device. Your Audius library and downloaded music stay available.', 'Clear history')) return;
    clearingRef.current = true; setClearing(true);
    try { await clearLocalListeningHistory(uid); refresh(); }
    catch { setError('Could not clear all history on this device. Please try again.'); }
    finally { clearingRef.current = false; setClearing(false); }
  };
  const rows = useMemo(() => {
    const grouped: ({ id: string; day: string } | { id: string; entry: ListeningHistoryEntry })[] = [];
    let previous = '';
    entries.forEach((entry) => {
      const day = calendarDayLabel(entry.playedAt);
      if (day !== previous) { grouped.push({ id: `day:${entry.id}`, day }); previous = day; }
      grouped.push({ id: entry.id, entry });
    });
    return grouped;
  }, [entries]);
  const queue = [...new Map(entries.map((entry) => [entry.song.id, entry.song])).values()];
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Listening History' }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 180 }]}
        data={rows}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={20}
        keyExtractor={(row) => row.id}
        refreshing={loading && !!entries.length}
        onRefresh={refresh}
        ListHeaderComponent={(
          <View style={styles.intro}>
            <LiquidSearchField
              placeholder="Find a song or artist"
              value={query}
              onChangeText={setQuery}
            />
          </View>
        )}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.accent} style={{ padding: 50 }} /> : !error ? (
          <View style={styles.empty}><SymbolView name="clock.arrow.circlepath" size={34} tintColor={colors.accent} /><Text style={[styles.emptyTitle, { color: colors.text }]}>{search ? 'No matching plays' : 'Nothing here yet'}</Text><Text style={[styles.emptyBody, { color: colors.secondaryText }]}>{search ? 'Try another song or artist.' : 'Songs you play will appear here.'}</Text></View>
        ) : null}
        ListFooterComponent={(
          <View style={historyStyles.footer}>
            {error && <><Text accessibilityRole="alert" style={{ color: colors.secondaryText, textAlign: 'center' }}>{error}</Text><Pressable accessibilityRole="button" onPress={entries.length && hasMore ? loadMore : refresh} style={historyStyles.action}><Text style={{ color: colors.accent }}>Try again</Text></Pressable></>}
            {loadingMore ? <ActivityIndicator color={colors.accent} style={styles.footerLoader} /> : hasMore && !error ? <Pressable accessibilityRole="button" onPress={loadMore} style={historyStyles.action}><Text style={{ color: colors.accent }}>Load older plays</Text></Pressable> : null}
            {!loading && <Pressable accessibilityRole="button" disabled={clearing} onPress={() => void clearHistory()} style={historyStyles.action}><Text style={{ color: '#F06C80' }}>{clearing ? 'Clearing history…' : 'Clear history on this device'}</Text></Pressable>}
          </View>
        )}
        onEndReached={() => { if (!error) loadMore(); }}
        onEndReachedThreshold={0.4}
        renderItem={({ item: row }) => {
          if ('day' in row) return <Text accessibilityRole="header" style={[historyStyles.day, { color: colors.secondaryText }]}>{row.day}</Text>;
          const item = row.entry;
          return <HistoryRow entry={item} onPress={() => playSong(item.song, queue, 'Listening History')} onMenuPress={() => router.push(actionSheetHref({ type: 'song', id: item.song.id, title: item.song.title, subtitle: item.song.creator, image: item.song.imageSmall || item.song.image, artistId: item.song.artistId, source: item.song.source }))} />;
        }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
const historyStyles = StyleSheet.create({
  day: { fontSize: 14, fontWeight: '700', marginHorizontal: 10, paddingTop: 16, paddingBottom: 8 },
  action: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  footer: { paddingVertical: 16, gap: 6 },
});

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
  intro: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 4 },
  row: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 10, borderRadius: 17 },
  rowPressed: { transform: [{ scale: 0.99 }] },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSubtitle: { marginTop: 3, fontSize: 13 },
  menuButton: { width: 44, height: 44, borderRadius: 22 },
  empty: { alignItems: 'center', paddingTop: 90 },
  emptyTitle: { marginTop: 14, fontSize: 20, fontWeight: '700' },
  emptyBody: { marginTop: 5, fontSize: 14 },
  footerLoader: { paddingVertical: 24 },
});
