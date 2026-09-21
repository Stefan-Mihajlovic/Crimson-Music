import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '@/services/alert';

import type { SongSort } from '@/components/collection-tools';
import PlaylistCollectionScreen, { type PlaylistCollectionAction } from '@/components/playlist-collection-screen';
import { usePlaylistEditor } from '@/components/playlist-editor';
import BouncyPressable from '@/components/bouncy-pressable';
import { useAuth } from '@/providers/auth-provider';
import { useDownloads } from '@/providers/download-provider';
import { useNetwork } from '@/providers/network-provider';
import { useAppSettings } from '@/providers/settings-provider';
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
  const { user } = useAuth();
  const downloads = useDownloads();
  const { isDownloaded, ready: downloadsReady, songsForCollection } = downloads;
  const { isOffline } = useNetwork();
  const uid = user?.uid;
  const { colors } = useAppSettings();
  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [liked, setLiked] = useState(false);
  const [sort, setSort] = useState<SongSort>('original');
  const openEditor = usePlaylistEditor(uid);
  const [loadError, setLoadError] = useState(false);
  const reloadRequest = useRef(0);
  const likeRequest = useRef(0);
  const likePending = useRef(false);
  const isOwned = detail?.playlist.owned ?? owned === '1';
  const playlistSource =
    source === 'audius' || source === 'crimson' ? source : undefined;
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

  const editPlaylist = () => {
    if (!uid) return;
    openEditor({ playlist, songs,
      onSaved: (next) => {
            const byId = new Map(songs.map((song) => [song.id, song]));
            setDetail({
              playlist: next,
              songs: next.songs
                .map((id) => byId.get(id))
                .filter((song): song is PlaylistDetail['songs'][number] =>
                  Boolean(song),
                ),
            });
            requestLibraryRefresh();
      },
      onDeleted: () => {
            requestLibraryRefresh();
            router.back();
      },
    });
  };

  const actions: PlaylistCollectionAction[] = [
    ...(isOwned && !isOffline ? [{ label: 'Edit playlist', icon: 'pencil' as const, iconSize: 20, onPress: editPlaylist }] : []),
    ...(!isOwned ? [{ label: liked ? 'Remove playlist from library' : 'Save playlist to library', icon: liked ? 'heart.fill' as const : 'heart' as const, selected: liked, onPress: () => void toggleLike() }] : []),
    ...(downloads.supported ? [{ label: allDownloaded ? `${playlist.title} is available offline` : `Make ${playlist.title} available offline`, icon: allDownloaded ? 'checkmark.circle.fill' as const : 'icloud.and.arrow.down' as const, selected: allDownloaded, disabled: !songs.length || downloading || allDownloaded, loading: downloading, onPress: () => void savePlaylistOffline() }] : []),
  ];
  return (
    <PlaylistCollectionScreen playlist={playlist} songs={songs} sort={sort} onSortChange={setSort} actions={actions}
      expectedOffline={downloadRequested}
      unavailableForOffline={(songId) => downloads.isTrackUnavailableForCollection(downloadKey, songId)}
      emptyMessage={isOffline ? 'No saved songs from this playlist are available offline.' : 'This playlist does not have any playable songs yet.'}
      notice={loadError ? <Pressable accessibilityRole="button" onPress={() => void reload(false)} style={{ padding: 20 }}><Text style={{ color: colors.accent }}>Could not refresh this playlist. Tap to retry.</Text></Pressable> : null}>
    </PlaylistCollectionScreen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E0D13' },
  empty: { paddingHorizontal: 10, paddingVertical: 35, color: '#918A9D', fontSize: 15 },
});
