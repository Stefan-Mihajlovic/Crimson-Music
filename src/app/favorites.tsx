import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { SymbolView } from '@/components/app-symbol';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  useWindowDimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '@/services/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadFailure from '@/components/load-failure';
import CollectionTools, {
  collectionSongs,
  collectionDuration,
  type SongSort,
} from '@/components/collection-tools';
import DetailSongRow from '@/components/detail-song-row';
import BouncyPressable from '@/components/bouncy-pressable';
import CollectionHeaderPlayButton, {
  useCollectionHeaderPlaybackVisibility,
} from '@/components/collection-header-play-button';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { useAuth } from '@/providers/auth-provider';
import { useDownloads } from '@/providers/download-provider';
import { useNetwork } from '@/providers/network-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref } from '@/services/action-sheet';
import { CrimsonSong, loadFavoriteSongs } from '@/services/music';
import { subscribeToLibraryRefresh } from '@/services/navigation-events';

const favoritesArtwork = require('@/assets/images/onboarding/favorites.webp');
const favoritesDownloadKey = 'favorites';

export default function FavoritesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  const coverSize = width >= 1200 ? 208 : 180;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const uid = user?.uid;
  const downloads = useDownloads();
  const { isDownloaded, ready: downloadsReady, songsForCollection } = downloads;
  const { isOffline } = useNetwork();
  const { playSong } = usePlayer();
  const { colors } = useAppSettings();
  const [songs, setSongs] = useState<CrimsonSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sort, setSort] = useState<SongSort>('original');
  const visibleSongs = useMemo(
    () => collectionSongs(songs, '', sort),
    [songs, sort],
  );
  const reloadRequest = useRef(0);
  const collectionPlayback = useCollectionPlayback(visibleSongs, 'Favorites');
  const headerPlayback = useCollectionHeaderPlaybackVisibility(
    Boolean(songs.length),
    insets.top,
  );
  const renderHeaderPlayback = useCallback(
    () => (
      <CollectionHeaderPlayButton
        collectionName="Favorites"
        songs={visibleSongs}
      />
    ),
    [visibleSongs],
  );
  const screenOptions = useMemo(
    () => ({
      title: 'Favorites',
      headerRight: headerPlayback.visible ? renderHeaderPlayback : undefined,
    }),
    [headerPlayback.visible, renderHeaderPlayback],
  );

  const reload = useCallback(
    async (_showLoading: boolean) => {
      const request = ++reloadRequest.current;
      if (!uid) {
        setSongs([]);
        setLoading(false);
        return;
      }
      if (isOffline && !downloadsReady) {
        setLoading(true);
        return;
      }
      setLoadError(false);
      try {
        const cachedItems = await loadFavoriteSongs(uid, {
          offlineOnly: isOffline,
        });
        const items = isOffline
          ? cachedItems.filter((song) => isDownloaded(song.id))
          : cachedItems;
        const offlineFallback = songsForCollection(favoritesDownloadKey);
        if (request === reloadRequest.current) {
          setSongs(items.length || !isOffline ? items : offlineFallback);
        }
      } catch {
        if (request === reloadRequest.current) {
          setLoadError(true);
        }
      } finally {
        if (request === reloadRequest.current) setLoading(false);
      }
    },
    [downloadsReady, isDownloaded, isOffline, songsForCollection, uid],
  );

  useEffect(() => {
    void Promise.resolve().then(() => reload(true));
    return () => {
      reloadRequest.current += 1;
    };
  }, [reload]);

  useEffect(
    () => subscribeToLibraryRefresh(() => void reload(false)),
    [reload],
  );

  const openSongActions = (song: CrimsonSong) =>
    router.push(
      actionSheetHref({
        type: 'song',
        id: song.id,
        title: song.title,
        subtitle: song.creator,
        image: song.imageSmall || song.image,
        artistId: song.artistId,
      }),
    );
  const downloadRequested =
    downloads.isCollectionRequested(favoritesDownloadKey);
  const allDownloaded = downloads.isCollectionDownloaded(favoritesDownloadKey);
  const downloading = songs.some(
    (song) => downloads.statusFor(song.id).state === 'downloading',
  );
  const saveFavoritesOffline = async () => {
    if (!downloads.enabled) {
      Alert.alert(
        'Offline Listening is off',
        'Enable Offline Listening in Settings first.',
      );
      return;
    }
    const result = await downloads.downloadSongs(
      songs,
      'favorite',
      favoritesDownloadKey,
    );
    if (result.failed) {
      Alert.alert(
        'Offline saving finished',
        `${result.failed} songs could not be saved or did not fit within the storage limit.`,
      );
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={screenOptions} />
      <FlatList
        data={loading ? [] : visibleSongs}
        keyExtractor={(song) => song.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        renderItem={({ item: song }) => (
          <View style={{ paddingHorizontal: desktop ? 22 : 12 }}>
            <DetailSongRow
              expectedOffline={downloadRequested}
              song={song}
              unavailableForOffline={downloads.isTrackUnavailableForCollection(
                favoritesDownloadKey,
                song.id,
              )}
              onPress={() => playSong(song, visibleSongs, 'Favorites')}
              onLongPress={() => openSongActions(song)}
            />
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              color={colors.accent}
              size="large"
              style={styles.loader}
            />
          ) : loadError ? (
            <LoadFailure
              title="Favorites unavailable"
              onRetry={() => void reload(true)}
            />
          ) : (
            <Text style={[styles.empty, { color: colors.secondaryText }]}>
              {isOffline
                  ? 'Your downloaded favorites will appear here.'
                  : 'Songs you favorite will appear here.'}
            </Text>
          )
        }
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[{ paddingBottom: insets.bottom + 120 }, desktop && styles.desktopContent]}
        onScroll={headerPlayback.onScroll}
        scrollsToTop={false}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={[styles.hero, desktop && [styles.desktopHero, { backgroundColor: colors.elevated }]]}>
              <Image
                source={favoritesArtwork}
                contentFit="cover"
                style={desktop ? [styles.desktopCover, { width: coverSize, height: coverSize }] : StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={desktop ? [colors.accentSoft, colors.background] : [
                  'rgba(91,35,144,0.05)',
                  'rgba(14,13,19,0.58)',
                  colors.background,
                ]}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.heroCopy, desktop && styles.desktopHeroCopy]}>
                {desktop ? <Text style={[styles.desktopEyebrow, { color: colors.secondaryText }]}>Playlist</Text> : null}
                <Text style={[styles.name, desktop && [styles.desktopName, { color: colors.text, fontSize: width >= 1200 ? 54 : 42 }]]}>Favorites</Text>
                <Text style={[styles.metadata, desktop && { color: colors.secondaryText }]}>
                  Simply yours · {songs.length} songs ·{' '}
                  {collectionDuration(songs)}
                </Text>
                <View style={[styles.actions, desktop && styles.desktopActions]}>
                  {downloads.supported ? (
                    <BouncyPressable
                      accessibilityLabel={
                        allDownloaded
                          ? 'Favorites are available offline'
                          : 'Make Favorites available offline'
                      }
                      disabled={!songs.length || downloading || allDownloaded}
                      onPress={() => void saveFavoritesOffline()}
                      style={[
                        styles.downloadButton,
                        {
                          backgroundColor: colors.controlSurface,
                          borderColor: allDownloaded
                            ? colors.accent
                            : colors.border,
                        },
                      ]}
                    >
                      {downloading ? (
                        <ActivityIndicator color={colors.text} size="small" />
                      ) : (
                        <SymbolView
                          name={
                            allDownloaded
                              ? 'checkmark.circle.fill'
                              : 'icloud.and.arrow.down'
                          }
                          size={21}
                          tintColor={allDownloaded ? colors.accent : colors.text}
                        />
                      )}
                    </BouncyPressable>
                  ) : null}
                  <BouncyPressable
                    accessibilityLabel={
                      collectionPlayback.playing
                        ? 'Pause Favorites'
                        : 'Play Favorites'
                    }
                    disabled={
                      !visibleSongs.length || collectionPlayback.loading
                    }
                    onPress={collectionPlayback.toggleCollectionPlayback}
                    contentStyle={styles.playButtonContent}
                    pressedScale={0.9}
                    style={[
                      styles.playButton,
                      desktop ? styles.desktopPlayButton : styles.mobilePlayButton,
                      { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
                    ]}
                  >
                    {collectionPlayback.loading ? (
                      <ActivityIndicator color="#17121D" size="small" />
                    ) : (
                      <SymbolView
                        name={
                          collectionPlayback.playing
                            ? 'pause.fill'
                            : 'play.fill'
                        }
                        size={18}
                        tintColor="#17121D"
                        weight="bold"
                      />
                    )}
                    <Text style={styles.playText}>
                      {collectionPlayback.loading
                        ? 'Loading'
                        : collectionPlayback.playing
                          ? 'Pause'
                          : 'Play'}
                    </Text>
                  </BouncyPressable>
                </View>
              </View>
            </View>
            <CollectionTools
              showSearch={false}
              sort={sort}
              onSortChange={setSort}
              disabled={!visibleSongs.length}
              onShuffle={() => {
                const first =
                  visibleSongs[Math.floor(Math.random() * visibleSongs.length)];
                if (first) playSong(first, visibleSongs, 'Favorites', '', true);
              }}
            />
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  desktopContent: { width: '100%', maxWidth: 1440, alignSelf: 'center' },
  desktopHero: { height: 'auto', minHeight: 252, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', padding: 28, gap: 28 },
  desktopCover: { borderRadius: 10, flexShrink: 0, zIndex: 1, boxShadow: '0 12px 32px rgba(0,0,0,0.2)' },
  desktopHeroCopy: { flex: 1, minWidth: 0, paddingHorizontal: 0, paddingBottom: 0, zIndex: 1 },
  desktopEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  desktopName: { letterSpacing: -1.4, fontWeight: '800' },
  desktopActions: { flexWrap: 'wrap', marginTop: 20 },
  desktopPlayButton: { flexGrow: 0, flexShrink: 0, flexBasis: 132, width: 132 },
  mobilePlayButton: { flex: 1 },

  screen: { flex: 1, backgroundColor: '#0E0D13' },
  hero: { height: 390, justifyContent: 'flex-end', backgroundColor: '#321A47' },
  heroCopy: { paddingHorizontal: 22, paddingBottom: 12 },
  name: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.3,
  },
  metadata: { marginTop: 5, color: '#C8C0D1', fontSize: 14 },
  actions: { marginTop: 18, flexDirection: 'row', gap: 10 },
  downloadButton: {
    width: 50,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  playButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  playButtonContent: { flexDirection: 'row', gap: 7 },
  playText: { color: '#17121D', fontSize: 15, fontWeight: '800' },
  list: { minHeight: 130, paddingHorizontal: 12, paddingTop: 10 },
  loader: { marginTop: 35 },
  empty: {
    paddingHorizontal: 10,
    paddingVertical: 35,
    color: '#918A9D',
    fontSize: 15,
  },
  pressed: { opacity: 0.76 },
});
