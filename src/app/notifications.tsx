import { Image } from 'expo-image';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from '@/components/app-symbol';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/services/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/auth-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { useDetailRoutes } from '@/services/action-sheet';
import { getAudiusTrack } from '@/services/audius';
import { getCurrentAudiusUserId } from '@/services/audius-session';
import { AudiusNotification, getNotificationsStateVersion, isNotificationSeenInCrimson, loadNotificationsPage, markNotificationsSeen, notificationErrorMessage, NotificationsPage, subscribeNotificationUnreadCount } from '@/services/notifications';
import { calendarDayLabel } from '@/services/date-groups';

export default function NotificationsScreen() {
  const router = useRouter();
  const { artistHref, playlistHref } = useDetailRoutes();
  const insets = useSafeAreaInsets();
  const { colors, dataSaver } = useAppSettings();
  const { user } = useAuth();
  const { playSong } = usePlayer();
  const uid = user?.uid;
  const [result, setResult] = useState<{ uid: string; page: NotificationsPage } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'music' | 'activity'>('music');
  useSyncExternalStore(subscribeNotificationUnreadCount, getNotificationsStateVersion, () => 0);
  const requestRevision = useRef(0);
  const morePending = useRef(false);
  const openingItem = useRef(false);
  const page = result?.uid === uid ? result?.page : null;
  const filteredItems = useMemo(() => (page?.items || []).filter((item) => {
    const music = ['create', 'remix', 'track_added_to_purchased_album'].includes(item.type);
    return filter === 'all' || (filter === 'music' ? music : !music);
  }), [filter, page]);
  const rows = useMemo(() => {
    const grouped: ({ id: string; day: string } | { id: string; notification: AudiusNotification })[] = [];
    let previous = '';
    filteredItems.forEach((item) => {
      const day = calendarDayLabel(new Date(item.timestamp * 1000));
      if (day !== previous) { grouped.push({ id: `day:${item.id}`, day }); previous = day; }
      grouped.push({ id: item.id, notification: item });
    });
    return grouped;
  }, [filteredItems]);
  const markSeen = (items: AudiusNotification[]) => {
    if (uid) void markNotificationsSeen(uid, items).catch(() => setError('Seen status could not be saved on this device. Your Audius inbox is unchanged.'));
  };

  const refresh = useCallback((force = false) => {
    const revision = ++requestRevision.current;
    morePending.current = false;
    setLoadingMore(false);
    setError(null);
    setLoading(true);
    if (!uid) { setResult(null); setLoading(false); return; }
    void loadNotificationsPage(uid, null, { force, dataSaver })
      .then((nextPage) => { if (revision === requestRevision.current) setResult({ uid, page: nextPage }); })
      .catch((reason) => { if (revision === requestRevision.current) setError(notificationErrorMessage(reason)); })
      .finally(() => { if (revision === requestRevision.current) setLoading(false); });
  }, [dataSaver, uid]);

  useFocusEffect(useCallback(() => {
    refresh();
    return () => { requestRevision.current += 1; };
  }, [refresh]));

  const loadMore = () => {
    if (!uid || !page?.hasMore || !page.cursor || loading || morePending.current) return;
    const revision = requestRevision.current;
    morePending.current = true;
    setLoadingMore(true);
    setError(null);
    void loadNotificationsPage(uid, page.cursor, { dataSaver })
      .then((nextPage) => {
        if (revision !== requestRevision.current) return;
        setResult((previous) => {
          if (previous?.uid !== uid) return previous;
          const unique = new Map(previous.page.items.map((item) => [item.id, item]));
          nextPage.items.forEach((item) => unique.set(item.id, item));
          return { uid, page: { ...nextPage, items: [...unique.values()] } };
        });
      })
      .catch((reason) => { if (revision === requestRevision.current) setError(notificationErrorMessage(reason)); })
      .finally(() => { if (revision === requestRevision.current) { morePending.current = false; setLoadingMore(false); } });
  };

  const openAudius = (url = 'https://audius.co/notifications') => {
    void Linking.openURL(url).catch(() => Alert.alert('Could not open Audius', 'Please try again.'));
  };

  const openNotification = async (item: AudiusNotification) => {
    if (openingItem.current || uid !== getCurrentAudiusUserId()) return;
    markSeen([item]);
    const target = item.target;
    if (target.type === 'audius') return openAudius(target.url);
    if (target.type === 'artist') return router.push(artistHref(target.id));
    if (target.type === 'playlist') return router.push(playlistHref(target.id, false, 'audius'));
    openingItem.current = true;
    try {
      const song = await getAudiusTrack(target.id);
      if (uid !== getCurrentAudiusUserId()) return;
      if (!song.streamable) { Alert.alert('Track unavailable', 'Open Audius to view this track.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Audius', onPress: () => openAudius() }]); return; }
      await playSong(song, [song], 'Notifications');
    } catch { Alert.alert('Could not open this track', 'Please try again.'); }
    finally { openingItem.current = false; }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <FlatList
        data={rows}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 180 }]}
        keyExtractor={(item) => item.id}
        initialNumToRender={12}
        windowSize={7}
        refreshing={loading && !!page}
        onRefresh={() => refresh(true)}
        ListHeaderComponent={(
          <View style={styles.intro}>
            <View style={styles.filters}>
              {([{ id: 'all', label: 'All' }, { id: 'music', label: 'New music' }, { id: 'activity', label: 'Activity' }] as const).map((item) => (
                <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: filter === item.id }} onPress={() => setFilter(item.id)} style={[styles.filter, { backgroundColor: filter === item.id ? colors.accent : colors.controlSurface, borderColor: colors.border }]}><Text style={{ color: filter === item.id ? '#FFFFFF' : colors.text, fontWeight: '600' }}>{item.label}</Text></Pressable>
              ))}
            </View>
            {!!page?.unreadCount && <Text style={[styles.unreadLabel, { color: colors.accent }]}>{page.unreadCount} unread in Audius</Text>}
            {!!filteredItems.length && <Pressable accessibilityRole="button" onPress={() => markSeen(filteredItems)} style={styles.seenAction}><Text style={{ color: colors.accent }}>Mark these as seen in Crimson</Text></Pressable>}
          </View>
        )}
        ListEmptyComponent={loading ? <ActivityIndicator color={colors.accent} size="large" style={styles.loader} /> : !error ? (
          <View style={styles.empty}>
            <SymbolView name="bell" size={36} tintColor={colors.accent} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{filter === 'all' ? 'You’re all caught up' : 'No updates in this category'}</Text>
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>Your Audius notifications will appear here. Older pages may contain more updates.</Text>
          </View>
        ) : null}
        renderItem={({ item: row }) => {
          if ('day' in row) return <Text accessibilityRole="header" style={[styles.dateLabel, { color: colors.secondaryText }]}>{row.day}</Text>;
          const item = row.notification;
          const unseen = item.unread && !isNotificationSeenInCrimson(uid, item);
          const external = item.target.type === 'audius';
          return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${unseen ? 'New in Crimson. ' : ''}${item.title}. ${item.message}${external ? '. Opens Audius' : ''}`}
            onPress={() => { void openNotification(item); }}
            style={({ pressed }) => [styles.row, { backgroundColor: unseen ? colors.accentSoft : colors.controlSurface, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}>
            {item.image ? <Image source={{ uri: item.image }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.id} style={styles.avatar} /> : <View style={[styles.avatar, styles.fallback, { backgroundColor: colors.surface }]}><SymbolView name="bell.fill" size={20} tintColor={colors.accent} /></View>}
            <View style={styles.copy}>
              <View style={styles.rowHeading}><Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>{unseen && <View style={[styles.dot, { backgroundColor: colors.accent }]} />}</View>
              <Text style={[styles.message, { color: colors.text }]}>{item.message}</Text>
              <Text style={[styles.time, { color: colors.secondaryText }]}>{formatNotificationTime(item.timestamp)}</Text>
              {external && <Text style={[styles.time, { color: colors.accent }]}>View in Audius ↗</Text>}
            </View>
            <SymbolView name={external ? 'arrow.up.right' : 'chevron.right'} size={13} tintColor={colors.mutedText} />
          </Pressable>
        ); }}
        ListFooterComponent={(
          <View style={styles.footer}>
            {error && <Text accessibilityRole="alert" style={[styles.error, { color: colors.secondaryText }]}>{error}</Text>}
            {loadingMore ? <ActivityIndicator color={colors.accent} /> : error ? (
              <Pressable accessibilityRole="button" onPress={() => refresh(true)} style={[styles.action, { backgroundColor: colors.surface }]}><Text style={[styles.actionText, { color: colors.accent }]}>Try again</Text></Pressable>
            ) : page?.hasMore ? (
              <Pressable accessibilityRole="button" onPress={loadMore} style={[styles.action, { backgroundColor: colors.surface }]}><Text style={[styles.actionText, { color: colors.accent }]}>Load older notifications</Text></Pressable>
            ) : null}
            {!loading && <Pressable accessibilityRole="link" onPress={() => openAudius()} style={styles.audiusLink}><Text style={[styles.actionText, { color: colors.accent }]}>Open inbox in Audius</Text></Pressable>}
          </View>
        )}
      />
    </View>
  );
}

function formatNotificationTime(timestamp: number) {
  const date = new Date(timestamp * 1000);
  const elapsed = Math.max(0, Date.now() - date.getTime());
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  intro: { paddingTop: 12, paddingBottom: 10, paddingHorizontal: 4 },
  unreadLabel: { fontSize: 13, fontWeight: '600', marginTop: 10 },
  filters: { flexDirection: 'row', gap: 8 },
  filter: { minHeight: 44, flex: 1, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  seenAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  dateLabel: { fontSize: 14, fontWeight: '700', paddingVertical: 12, paddingHorizontal: 4 },
  loader: { paddingVertical: 70 },
  empty: { alignItems: 'center', paddingTop: 70, paddingBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: 16 },
  emptyText: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  rowHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowTitle: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  message: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  time: { fontSize: 12, marginTop: 7 },
  footer: { paddingTop: 12, alignItems: 'center' },
  error: { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingHorizontal: 12, marginBottom: 15 },
  action: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 18 },
  actionText: { fontSize: 14, fontWeight: '600' },
  audiusLink: { padding: 20 },
});
