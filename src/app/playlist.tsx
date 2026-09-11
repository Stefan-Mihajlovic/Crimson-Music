import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import CollectionTools, {
  collectionSongs,
  collectionDuration,
  type SongSort,
} from '@/components/collection-tools';
import PlaylistEditor from '@/components/playlist-editor';
import DetailSongRow from '@/components/detail-song-row';
import BouncyPressable from '@/components/bouncy-pressable';
import CollectionHeaderPlayButton, {
  useCollectionHeaderPlaybackVisibility,
} from '@/components/collection-header-play-button';
import PlaylistCover from '@/components/playlist-cover';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { useAuth } from '@/providers/auth-provider';
import { useDownloads } from '@/providers/download-provider';
import { useNetwork } from '@/providers/network-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref } from '@/services/action-sheet';
import {
  getUserCollectionState,
  loadPlaylistDetail,
  PlaylistDetail,
  toggleUserCollectionItem,
} from '@/services/music';
import {
  requestLibraryRefresh,
  subscribeToLibraryRefresh,
} from '@/services/navigation-events';

export default function PlaylistDetailScreen() {
  const { id, owned, source, title } = useLocalSearchParams<{
    id: string;
    owned?: string;
    source?: string;
    title?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const downloads = useDownloads();
  const { isDownloaded, ready: downloadsReady, songsForCollection } = downloads;
  const { isOffline } = useNetwork();
  const uid = user?.uid;
  const { playSong } = usePlayer();
  const { colors } = useAppSettings();
  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [liked, setLiked] = useState(false);
  const [sort, setSort] = useState<SongSort>('original');
  const [editing, setEditing] = useState(false);
  const visibleSongs = useMemo(
    () => collectionSongs(detail?.songs || [], '', sort),
    [detail?.songs, sort],
  );
  const [loadError, setLoadError] = useState(false);
  const reloadRequest = useRef(0);
  const likeRequest = useRef(0);
  const likePending = useRef(false);
  const isOwned = detail?.playlist.owned ?? owned === '1';
  const playlistSource =
    source === 'audius' || source === 'crimson' ? source : undefined;
  const collectionPlayback = useCollectionPlayback(
    visibleSongs,
    detail?.playlist.title ?? '',
    String(id),
  );
  const headerPlayback = useCollectionHeaderPlaybackVisibility(
    Boolean(detail?.songs.length),
    insets.top,
  );
  const renderHeaderPlayback = useCallback(
    () => (
      <CollectionHeaderPlayButton
        collectionId={String(id)}
        collectionName={detail?.playlist.title ?? ''}
        songs={visibleSongs}
      />
    ),
    [detail?.playlist.title, visibleSongs, id],
  );
  const screenOptions = useMemo(
    () => ({
      title: detail?.playlist.title ?? '',
      headerRight: headerPlayback.visible ? renderHeaderPlayback : undefined,
    }),
    [detail?.playlist.title, headerPlayback.visible, renderHeaderPlayback],
  );

  const reload = useCallback(
    async (_showError: boolean) => {
      const request = ++reloadRequest.current;
      if (isOffline && !downloadsReady) return;
      setLoadError(false);
      try {
        const loadedDetail = await loadPlaylistDetail(
          String(id),
          uid,
          owned === '1',
          playlistSource,
          { offlineOnly: isOffline },
        );
        const nextDetail = isOffline
          ? {
              ...loadedDetail,
              songs: loadedDetail.songs.filter((song) => isDownloaded(song.id)),
            }
          : loadedDetail;
        if (request === reloadRequest.current) setDetail(nextDetail);
      } catch {
        const offlineSongs = songsForCollection(`playlist:${String(id)}`);
        if (
          isOffline &&
          offlineSongs.length &&
          request === reloadRequest.current
        ) {
          const firstSong = offlineSongs[0];
          setDetail({
            playlist: {
              id: String(id),
              source: playlistSource || 'audius',
              title: String(title || 'Offline Playlist'),
              artists: 'Available offline',
              image: firstSong.image,
              imageSmall: firstSong.imageSmall,
              likes: '0',
              songs: offlineSongs.map((song) => song.id),
              category: '',
              owned: owned === '1',
            },
            songs: offlineSongs,
          });
          return;
        }
        if (request === reloadRequest.current) setLoadError(true);
      }
    },
    [
      downloadsReady,
      id,
      isDownloaded,
      isOffline,
      owned,
      playlistSource,
      songsForCollection,
      title,
      uid,
    ],
  );

  useEffect(() => {
    void Promise.resolve().then(() => {
      return reload(true);
    });
    return () => {
      reloadRequest.current += 1;
    };
  }, [reload]);
  useEffect(
    () => subscribeToLibraryRefresh(() => void reload(false)),
    [reload],
  );
  useEffect(() => {
    const request = ++likeRequest.current;
    if (!isOffline && !isOwned && user?.uid && id)
      getUserCollectionState(user.uid, 'LikedPlaylists', String(id))
        .then((value) => {
          if (request === likeRequest.current) setLiked(value);
        })
        .catch(() => undefined);
    return () => {
      likeRequest.current += 1;
    };
  }, [id, isOffline, isOwned, user?.uid]);

  if (!detail)
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        {loadError ? (
          <>
            <Text style={[styles.empty, { color: colors.secondaryText }]}>
              This playlist could not be loaded. Check your connection and try
              again.
            </Text>
            <BouncyPressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading playlist"
              onPress={() => void reload(false)}
            >
              <Text style={{ color: colors.accent, padding: 16 }}>
                Try again
              </Text>
            </BouncyPressable>
          </>
        ) : (
          <ActivityIndicator color={colors.accent} size="large" />
        )}
      </View>
    );
  const { playlist, songs } = detail;
  const downloadKey = `playlist:${playlist.id}`;
  const downloadRequested = downloads.isCollectionRequested(downloadKey);
  const allDownloaded = downloads.isCollectionDownloaded(downloadKey);
  const downloading = songs.some(
    (song) => downloads.statusFor(song.id).state === 'downloading',
  );

  const toggleLike = async () => {
    if (!user?.uid || isOwned || likePending.current) return;
    likePending.current = true;
    const request = ++likeRequest.current;
    try {
      const value = await toggleUserCollectionItem(
        user.uid,
        'LikedPlaylists',
        playlist.id,
        playlist,
      );
      if (request === likeRequest.current) {
        setLiked(value);
        requestLibraryRefresh();
      }
    } catch {
      Alert.alert('Could not update playlist', 'Please try again.');
    } finally {
      likePending.current = false;
    }
  };
  const openSongActions = (song: PlaylistDetail['songs'][number]) =>
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
  const savePlaylistOffline = async () => {
    if (!downloads.enabled) {
      Alert.alert(
        'Offline Listening is off',
        'Enable Offline Listening in Settings first.',
      );
      return;
    }
    const result = await downloads.downloadSongs(songs, 'manual', downloadKey);
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
        data={visibleSongs}
        keyExtractor={(song) => song.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        renderItem={({ item: song }) => (
          <View style={{ paddingHorizontal: 12 }}>
            <DetailSongRow
              expectedOffline={downloadRequested}
              song={song}
              unavailableForOffline={downloads.isTrackUnavailableForCollection(
                downloadKey,
                song.id,
              )}
              onPress={() =>
                playSong(song, visibleSongs, playlist.title, playlist.id)
              }
              onLongPress={() => openSongActions(song)}
            />
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.secondaryText }]}>
            {isOffline
                ? 'No saved songs from this playlist are available offline.'
                : 'This playlist does not have any playable songs yet.'}
          </Text>
        }
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        onScroll={headerPlayback.onScroll}
        scrollsToTop={false}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <>
            <View style={styles.hero}>
              <PlaylistCover
                borderRadius={0}
                playlist={playlist}
                preferLarge
                showPlayingIndicator={false}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={[
                  'transparent',
                  'rgba(14,13,19,0.62)',
                  colors.background,
                ]}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroCopy}>
                <Text style={styles.name}>{playlist.title}</Text>
                <Text style={styles.metadata}>
                  {playlist.artists} · {songs.length} songs ·{' '}
                  {collectionDuration(songs)}
                </Text>
                {playlist.description ? (
                  <Text numberOfLines={2} style={styles.metadata}>
                    {playlist.description}
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  {isOwned && !isOffline ? (
                    <BouncyPressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit playlist"
                      onPress={() => setEditing(true)}
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: colors.controlSurface,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <SymbolView
                        name="pencil"
                        size={20}
                        tintColor={colors.text}
                      />
                    </BouncyPressable>
                  ) : null}
                  {!isOwned ? (
                    <BouncyPressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        liked
                          ? 'Remove playlist from library'
                          : 'Save playlist to library'
                      }
                      onPress={() => void toggleLike()}
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: colors.controlSurface,
                          borderColor: liked ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <SymbolView
                        name={liked ? 'heart.fill' : 'heart'}
                        size={21}
                        tintColor={liked ? colors.accent : colors.text}
                      />
                    </BouncyPressable>
                  ) : null}
                  <BouncyPressable
                    accessibilityLabel={
                      allDownloaded
                        ? `${playlist.title} is available offline`
                        : `Make ${playlist.title} available offline`
                    }
                    disabled={!songs.length || downloading || allDownloaded}
                    onPress={() => void savePlaylistOffline()}
                    style={[
                      styles.iconButton,
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
                  <BouncyPressable
                    accessibilityLabel={
                      collectionPlayback.playing
                        ? `Pause ${playlist.title}`
                        : `Play ${playlist.title}`
                    }
                    disabled={
                      !visibleSongs.length || collectionPlayback.loading
                    }
                    onPress={collectionPlayback.toggleCollectionPlayback}
                    contentStyle={styles.playButtonContent}
                    pressedScale={0.9}
                    style={[
                      styles.playButton,
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
                if (first)
                  playSong(
                    first,
                    visibleSongs,
                    playlist.title,
                    playlist.id,
                    true,
                  );
              }}
            />
            {loadError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void reload(false)}
                style={{ padding: 20 }}
              >
                <Text style={{ color: colors.accent }}>
                  Could not refresh this playlist. Tap to retry.
                </Text>
              </Pressable>
            ) : null}
          </>
        }
      />
      {editing && uid ? (
        <PlaylistEditor
          uid={uid}
          playlist={playlist}
          songs={songs}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            const byId = new Map(songs.map((song) => [song.id, song]));
            setDetail({
              playlist: next,
              songs: next.songs
                .map((id) => byId.get(id))
                .filter((song): song is PlaylistDetail['songs'][number] =>
                  Boolean(song),
                ),
            });
            setEditing(false);
            requestLibraryRefresh();
          }}
          onDeleted={() => {
            setEditing(false);
            requestLibraryRefresh();
            router.back();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E0D13' },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E0D13',
  },
  hero: { height: 390, justifyContent: 'flex-end', backgroundColor: '#201A29' },
  heroCopy: { paddingHorizontal: 22, paddingBottom: 12 },
  name: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  metadata: { marginTop: 5, color: '#C0B8CA', fontSize: 14 },
  actions: { marginTop: 18, flexDirection: 'row', gap: 10 },
  iconButton: {
    width: 50,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  playButton: {
    height: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  playButtonContent: { flexDirection: 'row', gap: 7 },
  playText: { color: '#17121D', fontSize: 15, fontWeight: '800' },
  list: { paddingHorizontal: 12, paddingTop: 10 },
  empty: {
    paddingHorizontal: 10,
    paddingVertical: 35,
    color: '#918A9D',
    fontSize: 15,
  },
});
