import { Image } from 'expo-image';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SFSymbol } from 'sf-symbols-typescript';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth-provider';
import PlaylistCover from '@/components/playlist-cover';
import { DownloadError, useDownloads } from '@/providers/download-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { useDetailRoutes } from '@/services/action-sheet';
import { getAudiusTrack } from '@/services/audius';
import {
  CrimsonCollectionField,
  CrimsonPlaylist,
  CrimsonSong,
  getUserCollectionState,
  loadArtistDetail,
  loadLibraryFeed,
  loadPlaylistDetail,
  normalizeRemoteImageUrl,
  setSongInOwnedPlaylist,
  toggleUserCollectionItem,
} from '@/services/music';
import { requestLibraryRefresh } from '@/services/navigation-events';

type SheetType = 'song' | 'artist' | 'playlist';

export default function ActionSheetScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { artistHref, playlistHref } = useDetailRoutes();
  const { user } = useAuth();
  const downloads = useDownloads();
  const { playSong, playNextInQueue, addToQueue } = usePlayer();
  const { colors, reduceMotion } = useAppSettings();
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
    title?: string;
    subtitle?: string;
    image?: string;
    artistId?: string;
    source?: string;
    coverImages?: string;
  }>();
  const type = (params.type || 'song') as SheetType;
  const id = String(params.id || '');
  const title = String(params.title || 'Crimson Music');
  const subtitle = String(params.subtitle || '');
  // Expo Router decodes escaped separators inside artwork URLs.
  // Normalize them again before handing the URL to the native image loader.
  const image = normalizeRemoteImageUrl(String(params.image || ''));
  const source =
    params.source === 'audius' || params.source === 'crimson'
      ? params.source
      : undefined;
  const artistId = String(params.artistId || '');
  const routeCoverImages = useMemo(
    () => parseCoverImages(params.coverImages),
    [params.coverImages],
  );
  const [selected, setSelected] = useState(false);
  const [working, setWorking] = useState(false);
  const queuePending = useRef(false);
  const [queueFeedback, setQueueFeedback] = useState('');
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [playlists, setPlaylists] = useState<CrimsonPlaylist[]>([]);
  const [playlistSelections, setPlaylistSelections] = useState<
    Record<string, boolean>
  >({});
  const [song, setSong] = useState<CrimsonSong | null>(null);
  const [playlistArtwork, setPlaylistArtwork] = useState<Pick<
    CrimsonPlaylist,
    'coverImages' | 'image' | 'imageSmall' | 'title'
  > | null>(null);

  const collectionField = useMemo<CrimsonCollectionField>(() => {
    if (type === 'artist') return 'FollowedArtists';
    if (type === 'playlist') return 'LikedPlaylists';
    return 'LikedSongs';
  }, [type]);

  useEffect(() => {
    if (!user?.uid || !id) return;
    let active = true;
    const task = InteractionManager.runAfterInteractions(() => {
      getUserCollectionState(user.uid, collectionField, id)
        .then((value) => {
          if (active) setSelected(value);
        })
        .catch(() => undefined);
    });
    return () => {
      active = false;
      task.cancel();
    };
  }, [collectionField, id, user?.uid]);

  useEffect(() => {
    if (type !== 'song' || !id) return;
    let active = true;
    getAudiusTrack(id)
      .then((track) => {
        if (active) setSong(track);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [id, type]);

  useEffect(() => {
    if (type !== 'playlist' || !id) return;
    let active = true;
    loadPlaylistDetail(id, user?.uid, false, source)
      .then((detail) => {
        if (active) setPlaylistArtwork(detail.playlist);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [id, source, type, user?.uid]);

  const toggleCollection = async () => {
    if (!user?.uid || !id || working) return;
    setWorking(true);
    try {
      setSelected(
        await toggleUserCollectionItem(
          user.uid,
          collectionField,
          id,
          undefined,
          source,
        ),
      );
      requestLibraryRefresh();
    } catch {
      Alert.alert('Could not update your library', 'Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const enqueueSong = async (next: boolean) => {
    if (queuePending.current || working || !id) return;
    queuePending.current = true;
    setWorking(true);
    setQueueFeedback('');
    try {
      const track = song || (await getAudiusTrack(id));
      if (!track.streamable)
        throw new Error('This song is not available for playback.');
      setSong(track);
      if (next) playNextInQueue(track);
      else addToQueue(track);
      setQueueFeedback(
        next ? 'Added to play next' : 'Added to the end of your queue',
      );
    } catch (reason) {
      setQueueFeedback(
        reason instanceof Error
          ? reason.message
          : 'Could not add this song. Try again.',
      );
    } finally {
      queuePending.current = false;
      setWorking(false);
    }
  };

  const openSongArtist = async () => {
    if (working) return;
    let targetArtistId = artistId;
    if (!targetArtistId) {
      setWorking(true);
      try {
        targetArtistId = (await getAudiusTrack(id)).artistId;
      } catch {
        Alert.alert('Artist unavailable', 'Could not load this song’s artist.');
      } finally {
        setWorking(false);
      }
    }
    if (!targetArtistId) return;
    router.dismiss();
    setTimeout(
      () => router.push(artistHref(targetArtistId)),
      reduceMotion ? 0 : 120,
    );
  };

  const playCollection = async () => {
    if (working) return;
    setWorking(true);
    try {
      const songs =
        type === 'artist'
          ? (await loadArtistDetail(id)).songs
          : (await loadPlaylistDetail(id, user?.uid, false, source)).songs;
      if (!songs.length) throw new Error('There are no songs to play.');
      playSong(songs[0], songs, title, type === 'playlist' ? id : '');
      router.dismiss();
    } catch {
      Alert.alert(
        'Nothing to play',
        'This collection does not have any available songs.',
      );
    } finally {
      setWorking(false);
    }
  };

  const openDetail = () => {
    router.dismiss();
    setTimeout(
      () =>
        router.push(
          type === 'artist'
            ? artistHref(id)
            : playlistHref(id, false, source, title),
        ),
      reduceMotion ? 0 : 120,
    );
  };

  const openPlaylistPicker = async () => {
    if (!user?.uid) return;
    setShowPlaylists(true);
    try {
      const library = await loadLibraryFeed(user.uid, { selectedTrackId: id });
      setPlaylists(library.playlists);
      setPlaylistSelections(
        Object.fromEntries(
          library.playlists.map((playlist) => [
            playlist.id,
            playlist.songs.includes(id),
          ]),
        ),
      );
    } catch {
      Alert.alert('Could not load playlists', 'Please try again.');
    }
  };

  const openCreatePlaylist = () => {
    router.dismiss();
    setTimeout(
      () => {
        router.navigate(
          `/(app)/(library)/create-playlist?trackId=${encodeURIComponent(id)}` as Href,
        );
      },
      reduceMotion ? 0 : 120,
    );
  };

  const togglePlaylistSong = async (playlist: CrimsonPlaylist) => {
    if (!user?.uid || !id || working) return;
    setWorking(true);
    try {
      const included = await setSongInOwnedPlaylist(user.uid, playlist.id, id);
      setPlaylistSelections((current) => ({
        ...current,
        [playlist.id]: included,
      }));
      requestLibraryRefresh();
    } catch {
      Alert.alert('Could not update the playlist', 'Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const showOfflineError = (error: unknown) => {
    const message =
      error instanceof DownloadError
        ? error.message
        : 'The song could not be saved for offline listening.';
    Alert.alert('Offline listening unavailable', message);
  };

  const toggleSongOffline = async () => {
    if (!id) return;
    if (downloads.isDownloaded(id)) {
      await downloads.removeDownload(id);
      return;
    }
    if (!downloads.enabled) {
      Alert.alert(
        'Offline Listening is off',
        'Enable Offline Listening in Settings first.',
      );
      return;
    }
    try {
      const target = song || (await getAudiusTrack(id));
      setSong(target);
      await downloads.downloadSong(target, 'manual');
    } catch (error) {
      showOfflineError(error);
    }
  };

  const makePlaylistAvailableOffline = async () => {
    if (!downloads.enabled) {
      Alert.alert(
        'Offline Listening is off',
        'Enable Offline Listening in Settings first.',
      );
      return;
    }
    if (working) return;
    setWorking(true);
    try {
      const detail = await loadPlaylistDetail(id, user?.uid, false, source);
      if (!detail.songs.length) throw new Error('This playlist has no songs.');
      router.dismiss();
      void downloads
        .downloadSongs(detail.songs, 'manual', `playlist:${detail.playlist.id}`)
        .then((result) => {
          if (result.failed) {
            Alert.alert(
              'Offline saving finished',
              `${result.downloaded} saved, ${result.skipped} already offline, and ${result.failed} unavailable or over the storage limit.`,
            );
          }
        });
    } catch (error) {
      showOfflineError(error);
      setWorking(false);
    }
  };

  const primaryLabel =
    type === 'artist'
      ? selected
        ? 'Unfollow artist'
        : 'Follow artist'
      : type === 'playlist'
        ? selected
          ? 'Remove from liked playlists'
          : 'Like playlist'
        : selected
          ? 'Remove from favorites'
          : 'Add to favorites';
  const typeIcon: SFSymbol =
    type === 'artist'
      ? 'person.crop.circle.fill'
      : type === 'playlist'
        ? 'rectangle.stack.fill'
        : 'music.note';
  const downloadStatus = statusForActionSheet(
    downloads.statusFor(id),
    downloads.isDownloaded(id),
    downloads.isTrackKnownUnavailable(id),
    song,
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.elevated }]}>
      {showPlaylists ? (
        <View style={styles.flex}>
          <View style={styles.pickerHeader}>
            <Pressable
              onPress={() => setShowPlaylists(false)}
              style={styles.headerButton}
            >
              <SymbolView
                name="chevron.left"
                size={17}
                tintColor={colors.text}
              />
              <Text
                style={[
                  styles.headerButtonText,
                  { color: colors.secondaryText },
                ]}
              >
                Back
              </Text>
            </Pressable>
            <Text style={[styles.pickerTitle, { color: colors.text }]}>
              Add to playlist
            </Text>
            <Pressable
              onPress={() => router.dismiss()}
              style={styles.headerButton}
            >
              <Text style={[styles.doneText, { color: colors.accent }]}>
                Done
              </Text>
            </Pressable>
          </View>
          <FlatList
            contentContainerStyle={styles.playlistList}
            data={playlists}
            initialNumToRender={9}
            keyExtractor={(playlist, index) => `${playlist.id}-${index}`}
            ListHeaderComponent={
              <ActionRow
                icon="plus.circle.fill"
                label="Create new playlist"
                onPress={openCreatePlaylist}
              />
            }
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.secondaryText }]}>
                You don&apos;t have a playlist yet.
              </Text>
            }
            renderItem={({ item: playlist }) => (
              <PlaylistPickerRow
                disabled={working}
                playlist={playlist}
                selected={playlistSelections[playlist.id]}
                onPress={() => void togglePlaylistSong(playlist)}
              />
            )}
            showsVerticalScrollIndicator={false}
            windowSize={7}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.actions,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.itemHeader}>
            <View
              style={[
                styles.itemArtwork,
                type === 'artist' && styles.roundArtwork,
              ]}
            >
              {type === 'playlist' ? (
                <PlaylistCover
                  borderRadius={17}
                  playlist={
                    playlistArtwork || {
                      coverImages: routeCoverImages,
                      image,
                      imageSmall: image,
                      title,
                    }
                  }
                  showPlayingIndicator={false}
                  style={StyleSheet.absoluteFill}
                />
              ) : image ? (
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={{ uri: image }}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <SymbolView name={typeIcon} size={27} tintColor={colors.text} />
              )}
            </View>
            <View style={styles.itemCopy}>
              <Text
                numberOfLines={1}
                style={[styles.itemTitle, { color: colors.text }]}
              >
                {title}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.itemSubtitle, { color: colors.secondaryText }]}
              >
                {subtitle}
              </Text>
            </View>
          </View>
          <View style={styles.separator} />
          <ActionRow
            disabled={working}
            icon={selected ? 'heart.fill' : 'heart'}
            label={primaryLabel}
            selected={selected}
            onPress={() => void toggleCollection()}
          />
          <ActionRow
            icon={type === 'song' ? 'person' : 'play.fill'}
            label={
              type === 'song'
                ? `See more from ${subtitle}`
                : type === 'artist'
                  ? 'Play artist'
                  : 'Play playlist'
            }
            onPress={
              type === 'song'
                ? () => void openSongArtist()
                : () => void playCollection()
            }
          />
          {type !== 'song' ? (
            <ActionRow
              icon="arrow.up.right"
              label={type === 'artist' ? 'Open artist' : 'Open playlist'}
              onPress={openDetail}
            />
          ) : null}
          {type === 'song' ? (
            <>
              <ActionRow
                disabled={working}
                icon="text.line.first.and.arrowtriangle.forward"
                label="Play next"
                onPress={() => void enqueueSong(true)}
              />
              <ActionRow
                disabled={working}
                icon="text.line.last.and.arrowtriangle.forward"
                label="Add to queue"
                onPress={() => void enqueueSong(false)}
              />
              {queueFeedback ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{
                    color: colors.accent,
                    paddingHorizontal: 18,
                    paddingBottom: 12,
                  }}
                >
                  {queueFeedback}
                </Text>
              ) : null}
            </>
          ) : null}
          {type === 'song' ? (
            <ActionRow
              icon="plus"
              label="Add to playlist"
              onPress={() => void openPlaylistPicker()}
            />
          ) : null}
          {type === 'song' ? (
            <ActionRow
              disabled={downloadStatus.disabled}
              icon={downloadStatus.icon}
              label={downloadStatus.label}
              loading={downloadStatus.loading}
              muted={downloadStatus.muted}
              selected={downloadStatus.selected}
              onPress={() => void toggleSongOffline()}
            />
          ) : null}
          {type === 'playlist' ? (
            <ActionRow
              disabled={working}
              icon="icloud.and.arrow.down"
              label="Make Playlist Available Offline"
              onPress={() => void makePlaylistAvailableOffline()}
            />
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

function parseCoverImages(value?: string) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map(String).filter(Boolean).slice(0, 4)
      : [];
  } catch {
    return [];
  }
}

function statusForActionSheet(
  status: ReturnType<ReturnType<typeof useDownloads>['statusFor']>,
  downloaded: boolean,
  knownUnavailable: boolean,
  song: CrimsonSong | null,
): {
  disabled?: boolean;
  icon: SFSymbol;
  label: string;
  loading?: boolean;
  muted?: boolean;
  selected?: boolean;
} {
  if (status.state === 'downloading') {
    return {
      icon: 'icloud.and.arrow.down',
      label: `Saving for offline… ${Math.round(status.progress * 100)}%`,
      loading: true,
    };
  }
  if (downloaded)
    return {
      icon: 'checkmark.circle.fill',
      label: 'Remove from Offline',
      selected: true,
    };
  if (status.state === 'error')
    return { icon: 'exclamationmark.triangle', label: 'Couldn’t Save Offline' };
  if (knownUnavailable || song?.streamable === false) {
    return {
      icon: 'icloud.slash',
      label: 'Stream unavailable',
      muted: true,
    };
  }
  return { icon: 'icloud.and.arrow.down', label: 'Make Available Offline' };
}

const ActionRow = memo(function ActionRow({
  disabled,
  icon,
  label,
  loading,
  muted,
  onPress,
  selected,
}: {
  disabled?: boolean;
  icon: SFSymbol;
  label: string;
  loading?: boolean;
  muted?: boolean;
  onPress: () => void;
  selected?: boolean;
}) {
  const { colors } = useAppSettings();
  const contentColor = selected
    ? colors.accent
    : muted
      ? colors.mutedText
      : colors.text;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={colors.accent}
          size="small"
          style={styles.rowIcon}
        />
      ) : (
        <SymbolView
          name={icon}
          size={23}
          style={styles.rowIcon}
          tintColor={contentColor}
        />
      )}
      <Text
        numberOfLines={1}
        style={[styles.rowLabel, { color: contentColor }]}
      >
        {label}
      </Text>
      <SymbolView name="chevron.right" size={13} tintColor={colors.mutedText} />
    </Pressable>
  );
});

const PlaylistPickerRow = memo(function PlaylistPickerRow({
  disabled,
  onPress,
  playlist,
  selected,
}: {
  disabled?: boolean;
  onPress: () => void;
  playlist: CrimsonPlaylist;
  selected?: boolean;
}) {
  const { colors } = useAppSettings();
  const contentColor = selected ? colors.accent : colors.text;
  return (
    <Pressable
      accessibilityLabel={`${selected ? 'Remove from' : 'Add to'} ${playlist.title}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        disabled && styles.disabled,
      ]}
    >
      <PlaylistCover
        borderRadius={12}
        playlist={playlist}
        showPlayingIndicator={false}
        style={styles.playlistRowArtwork}
      />
      <Text
        numberOfLines={1}
        style={[styles.rowLabel, { color: contentColor }]}
      >
        {playlist.title}
      </Text>
      <SymbolView
        name={selected ? 'checkmark.circle.fill' : 'plus.circle'}
        size={22}
        tintColor={selected ? colors.accent : colors.secondaryText}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  flex: { flex: 1 },
  actions: { flexGrow: 1, paddingTop: 8 },
  itemHeader: {
    minHeight: 108,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 21,
  },
  itemArtwork: {
    width: 64,
    height: 64,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: 'rgba(105,58,145,0.62)',
  },
  roundArtwork: { borderRadius: 32 },
  itemCopy: { flex: 1, minWidth: 0 },
  itemTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  itemSubtitle: { marginTop: 3, color: 'rgba(231,222,241,0.62)', fontSize: 14 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(231,222,241,0.16)',
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    paddingHorizontal: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(231,222,241,0.14)',
  },
  rowPressed: { backgroundColor: 'rgba(231,222,241,0.10)' },
  disabled: { opacity: 0.48 },
  rowIcon: { width: 28, height: 28 },
  playlistRowArtwork: { width: 46, height: 46, flexShrink: 0 },
  rowLabel: { flex: 1, color: '#F4EEFF', fontSize: 17, fontWeight: '600' },
  pickerHeader: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(231,222,241,0.16)',
  },
  headerButton: {
    minWidth: 68,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerButtonText: { color: '#D8C5F7', fontSize: 15 },
  doneText: {
    color: '#C28EFF',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  pickerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  playlistList: { paddingBottom: 24 },
  empty: { padding: 24, color: 'rgba(231,222,241,0.62)', fontSize: 15 },
});
