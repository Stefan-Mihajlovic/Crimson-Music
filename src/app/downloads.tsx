import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '@/services/alert';
import { useDownloads } from '@/providers/download-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import type { CrimsonSong } from '@/types/music';
export default function DownloadsScreen() {
  const downloads = useDownloads();
  const { playSong } = usePlayer();
  const { colors } = useAppSettings();
  const songs = [
    ...new Map(
      [
        ...downloads.jobs.map((job) => job.song),
        ...downloads.downloadedSongs,
      ].map((song) => [song.id, song]),
    ).values(),
  ];
  const report = (error: unknown) =>
    Alert.alert(
      'Download',
      error instanceof Error ? error.message : 'Try again.',
    );
  const button = (label: string, action: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={action}
      style={[
        styles.button,
        { borderColor: colors.border, backgroundColor: colors.controlSurface },
      ]}
    >
      <Text style={{ color: colors.accent, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
  const row = (song: CrimsonSong) => {
    const status = downloads.statusFor(song.id);
    const saved = status.state === 'downloaded';
    const waiting = status.state === 'waiting-for-wifi';
    const failed = status.state === 'error';
    const message = saved
      ? 'Saved on this device'
      : status.state === 'downloading'
        ? `Downloading · ${Math.round(status.progress * 100)}%`
        : waiting
          ? 'Waiting for Wi-Fi · restarts automatically'
          : failed
            ? status.message
            : 'Queued';
    return (
      <View style={[styles.row, { borderColor: colors.border }]}>
        <Image
          source={{ uri: song.imageSmall || song.image }}
          style={styles.cover}
        />
        <View style={{ flex: 1, gap: 7 }}>
          <Text
            numberOfLines={2}
            style={[styles.title, { color: colors.text }]}
          >
            {song.title}
          </Text>
          <Text style={{ color: colors.secondaryText }}>{message}</Text>
          {status.state === 'downloading' ? (
            <View
              style={[
                styles.progress,
                { backgroundColor: colors.surfaceStrong },
              ]}
            >
              <View
                style={{
                  height: 3,
                  width: `${status.progress * 100}%`,
                  backgroundColor: colors.accent,
                }}
              />
            </View>
          ) : null}
          <View style={styles.actions}>
            {saved ? (
              <>
                {button('Play', () =>
                  playSong(song, downloads.downloadedSongs, 'Downloads'),
                )}
                {button(
                  'Remove',
                  () => void downloads.removeDownload(song.id).catch(report),
                )}
              </>
            ) : (
              <>
                {failed || waiting
                  ? button(
                      'Retry',
                      () => void downloads.retryDownload(song.id).catch(report),
                    )
                  : null}
                {button('Cancel', () => downloads.cancelDownload(song.id))}
              </>
            )}
          </View>
        </View>
      </View>
    );
  };
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Downloads',
          headerShown: true,
          headerTransparent: false,
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
        }}
      />
      <FlatList
        data={songs}
        keyExtractor={(song) => song.id}
        renderItem={({ item }) => row(item)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 20 }}>
            <Text style={[styles.heading, { color: colors.text }]}>
              {downloads.downloadedCount} songs saved
            </Text>
            <Text style={{ color: colors.secondaryText }}>
              {(downloads.usedBytes / 1024 / 1024).toFixed(0)} MB of{' '}
              {(downloads.maxBytes / 1024 / 1024).toFixed(0)} MB used
            </Text>
            {!downloads.supported ? (
              <Text style={{ color: colors.secondaryText }}>
                Offline downloads are available in the iOS and Android apps.
              </Text>
            ) : !downloads.enabled ? (
              button('Enable offline listening', () =>
                downloads.setEnabled(true),
              )
            ) : null}
            {downloads.jobs.length
              ? button('Cancel all pending', downloads.cancelAllDownloads)
              : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.secondaryText }}>
            Save songs from their menu to listen without a connection.
          </Text>
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 44, gap: 12 },
  heading: { fontSize: 26, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cover: { height: 52, width: 52, borderRadius: 12 },
  title: { fontSize: 17, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    justifyContent: 'center',
  },
  progress: { height: 3, borderRadius: 3, overflow: 'hidden' },
});
