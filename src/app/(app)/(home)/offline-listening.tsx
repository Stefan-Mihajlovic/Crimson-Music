import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DetailSongRow from '@/components/detail-song-row';
import { useDownloads } from '@/providers/download-provider';
import { useNetwork } from '@/providers/network-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref } from '@/services/action-sheet';
import type { CrimsonSong } from '@/types/music';

const megabyte = 1024 * 1024;
const gigabyte = 1024 * megabyte;

function formatStorage(bytes: number) {
  if (bytes < gigabyte) return `${Math.round(bytes / megabyte)} MB`;
  return `${(bytes / gigabyte).toFixed(1)} GB`;
}

export default function OfflineListeningScreen() {
  const router = useRouter();
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const insets = useSafeAreaInsets();
  const { downloadedSongs, maxBytes, ready, usedBytes } = useDownloads();
  const { isOffline } = useNetwork();
  const { playSong } = usePlayer();
  const { colors } = useAppSettings();
  const enteredWhileOffline = useRef(auto === '1' || isOffline);

  useEffect(() => {
    if (isOffline) {
      enteredWhileOffline.current = true;
      return;
    }
    if (enteredWhileOffline.current) router.dismissTo('/(app)/(home)');
  }, [isOffline, router]);

  const openSongActions = (song: CrimsonSong) => router.push(actionSheetHref({
    type: 'song',
    id: song.id,
    title: song.title,
    subtitle: song.creator,
    image: song.imageSmall || song.image,
    artistId: song.artistId,
    source: song.source,
  }));

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShadowVisible: false, title: 'Offline Listening' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.summary, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
            <SymbolView name="icloud.and.arrow.down.fill" size={26} tintColor={colors.accent} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Available Offline</Text>
            <Text style={[styles.summarySubtitle, { color: colors.secondaryText }]}>
              {ready
                ? `${downloadedSongs.length} ${downloadedSongs.length === 1 ? 'song' : 'songs'} · ${formatStorage(usedBytes)} of ${formatStorage(maxBytes)}`
                : 'Loading saved music…'}
            </Text>
          </View>
        </View>

        {!ready ? (
          <ActivityIndicator color={colors.accent} size="large" style={styles.loader} />
        ) : downloadedSongs.length ? (
          <View style={styles.list}>
            {downloadedSongs.map((song) => (
              <DetailSongRow
                key={song.id}
                song={song}
                onPress={() => playSong(song, downloadedSongs, 'Offline Listening')}
                onLongPress={() => openSongActions(song)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <SymbolView name="icloud.and.arrow.down" size={38} tintColor={colors.mutedText} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing available offline yet</Text>
            <Text style={[styles.emptyCopy, { color: colors.secondaryText }]}>
              Long-press any available song or playlist and choose Make Available Offline.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 12, paddingTop: 14 },
  summary: { minHeight: 82, marginHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 15, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryTitle: { fontSize: 18, fontWeight: '800' },
  summarySubtitle: { marginTop: 3, fontSize: 12 },
  list: { marginTop: 17 },
  loader: { marginTop: 90 },
  empty: { alignItems: 'center', paddingHorizontal: 34, paddingTop: 90 },
  emptyTitle: { marginTop: 14, fontSize: 20, fontWeight: '800' },
  emptyCopy: { marginTop: 7, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
