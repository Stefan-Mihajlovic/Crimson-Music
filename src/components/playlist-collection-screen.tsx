import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useMemo, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SFSymbol } from 'sf-symbols-typescript';
import { SymbolView } from '@/components/app-symbol';
import BouncyPressable from '@/components/bouncy-pressable';
import CollectionTools, { collectionDuration, collectionSongs, type SongSort } from '@/components/collection-tools';
import CollectionHeaderPlayButton, { useCollectionHeaderPlaybackVisibility } from '@/components/collection-header-play-button';
import DetailSongRow from '@/components/detail-song-row';
import PlaylistCover from '@/components/playlist-cover';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref } from '@/services/action-sheet';
import type { CrimsonPlaylist, CrimsonSong } from '@/types/music';

export type PlaylistCollectionAction = {
  label: string;
  icon: SFSymbol;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  iconSize?: number;
};
export type PlaylistArtworkLayout = { style: StyleProp<ViewStyle>; size: number; borderRadius: number; desktop: boolean };

/** The playlist presentation is shared verbatim by Audius playlists, mixes and Local Music. */
export default function PlaylistCollectionScreen({
  playlist, songs, sourceName = playlist.title, sourceId = playlist.id, sort, onSortChange,
  actions = [], artwork, emptyMessage = 'This playlist does not have any playable songs yet.',
  emptyContent, loading = false, notice, expectedOffline, unavailableForOffline, children,
}: {
  playlist: CrimsonPlaylist;
  songs: CrimsonSong[];
  sourceName?: string;
  sourceId?: string;
  sort: SongSort;
  onSortChange: (sort: SongSort) => void;
  actions?: PlaylistCollectionAction[];
  artwork?: (layout: PlaylistArtworkLayout) => ReactNode;
  emptyMessage?: string;
  emptyContent?: ReactNode;
  loading?: boolean;
  notice?: ReactNode;
  expectedOffline?: boolean;
  unavailableForOffline?: (songId: string) => boolean;
  children?: ReactNode;
}) {
  const { colors } = useAppSettings();
  const { playSong } = usePlayer();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  const coverSize = width >= 1200 ? 208 : 180;
  const insets = useSafeAreaInsets();
  const visibleSongs = useMemo(() => collectionSongs(songs, '', sort), [songs, sort]);
  const collectionPlayback = useCollectionPlayback(visibleSongs, sourceName, sourceId);
  const headerPlayback = useCollectionHeaderPlaybackVisibility(Boolean(songs.length), insets.top);
  const renderHeaderPlayback = useCallback(() => <CollectionHeaderPlayButton collectionId={sourceId} collectionName={sourceName} songs={visibleSongs} />, [sourceId, sourceName, visibleSongs]);
  const screenOptions = useMemo(() => ({ title: playlist.title, headerRight: headerPlayback.visible ? renderHeaderPlayback : undefined }), [playlist.title, headerPlayback.visible, renderHeaderPlayback]);
  const artworkLayout: PlaylistArtworkLayout = {
    desktop, size: desktop ? coverSize : width, borderRadius: desktop ? 10 : 0,
    style: desktop ? [styles.desktopCover, { width: coverSize, height: coverSize }] : [StyleSheet.absoluteFill, { width: '100%', height: '100%' }],
  };
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <Stack.Screen options={screenOptions} />
    <FlatList
      data={visibleSongs}
      keyExtractor={(song) => song.id}
      initialNumToRender={10} maxToRenderPerBatch={10} windowSize={7}
      renderItem={({ item: song }) => <View style={{ paddingHorizontal: desktop ? 22 : 12 }}>
        <DetailSongRow expectedOffline={expectedOffline} song={song} unavailableForOffline={unavailableForOffline?.(song.id)}
          onPress={() => playSong(song, visibleSongs, sourceName, sourceId)}
          onLongPress={() => router.push(actionSheetHref({ type: 'song', id: song.id, title: song.title, subtitle: song.creator, image: song.imageSmall || song.image, artistId: song.artistId, source: song.source }))} />
      </View>}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.accent} size="large" style={styles.empty} /> : emptyContent ? <>{emptyContent}</> : <Text style={[styles.empty, { color: colors.secondaryText }]}>{emptyMessage}</Text>}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[{ paddingBottom: insets.bottom + 120 }, desktop && styles.desktopContent]}
      onScroll={headerPlayback.onScroll} scrollsToTop={false} scrollEventThrottle={16}
      ListHeaderComponent={<>
        <View style={[styles.hero, desktop && [styles.desktopHero, { backgroundColor: colors.elevated }]]}>
          {artwork ? artwork(artworkLayout) : <PlaylistCover borderRadius={artworkLayout.borderRadius} playlist={playlist} preferLarge showPlayingIndicator={false} style={artworkLayout.style} />}
          <LinearGradient colors={desktop ? [colors.accentSoft, colors.background] : ['transparent', 'rgba(14,13,19,0.62)', colors.background]} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroCopy, desktop && styles.desktopHeroCopy]}>
            {desktop ? <Text style={[styles.desktopEyebrow, { color: colors.secondaryText }]}>Playlist</Text> : null}
            <Text numberOfLines={desktop ? 2 : undefined} style={[styles.name, desktop && [styles.desktopName, { color: colors.text, fontSize: width >= 1200 ? 48 : 36 }]]}>{playlist.title}</Text>
            <Text style={[styles.metadata, desktop && { color: colors.secondaryText }]}>{playlist.artists} · {songs.length} songs · {collectionDuration(songs)}</Text>
            {playlist.description ? <Text numberOfLines={2} style={[styles.metadata, desktop && { color: colors.secondaryText }]}>{playlist.description}</Text> : null}
            <View style={[styles.actions, desktop && styles.desktopActions]}>
              {actions.map((action) => <BouncyPressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label}
                accessibilityState={{ selected: action.selected, disabled: action.disabled || action.loading }}
                disabled={action.disabled || action.loading} onPress={action.onPress}
                style={[styles.iconButton, { backgroundColor: colors.controlSurface, borderColor: action.selected ? colors.accent : colors.border }]}>
                {action.loading ? <ActivityIndicator color={colors.text} size="small" /> : <SymbolView name={action.icon} size={action.iconSize || 21} tintColor={action.selected ? colors.accent : colors.text} />}
              </BouncyPressable>)}
              <BouncyPressable accessibilityLabel={collectionPlayback.playing ? `Pause ${playlist.title}` : `Play ${playlist.title}`}
                disabled={!visibleSongs.length || collectionPlayback.loading} onPress={collectionPlayback.toggleCollectionPlayback}
                contentStyle={styles.playButtonContent} pressedScale={0.9}
                style={[styles.playButton, desktop ? styles.desktopPlayButton : styles.mobilePlayButton, { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' }]}>
                {collectionPlayback.loading ? <ActivityIndicator color="#17121D" size="small" /> : <SymbolView name={collectionPlayback.playing ? 'pause.fill' : 'play.fill'} size={18} tintColor="#17121D" weight="bold" />}
                <Text style={styles.playText}>{collectionPlayback.loading ? 'Loading' : collectionPlayback.playing ? 'Pause' : 'Play'}</Text>
              </BouncyPressable>
            </View>
          </View>
        </View>
        <CollectionTools showSearch={false} sort={sort} onSortChange={onSortChange} disabled={!visibleSongs.length}
          onShuffle={() => { const first = visibleSongs[Math.floor(Math.random() * visibleSongs.length)]; if (first) playSong(first, visibleSongs, sourceName, sourceId, true); }} />
        {notice}
      </>}
    />
    {children}
  </View>;
}
const styles = StyleSheet.create({
  desktopContent: { width: '100%', maxWidth: 1440, alignSelf: 'center' },
  desktopHero: { height: 'auto', minHeight: 252, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', padding: 28, gap: 28 },
  desktopCover: { borderRadius: 10, flexShrink: 0, zIndex: 1, boxShadow: '0 12px 32px rgba(0,0,0,0.2)' },
  desktopHeroCopy: { flex: 1, minWidth: 0, paddingHorizontal: 0, paddingBottom: 0, zIndex: 1 },
  desktopEyebrow: { fontSize: 10, fontWeight: '700', marginBottom: 8 },
  desktopName: { letterSpacing: -1.4, fontWeight: '800' },
  desktopActions: { flexWrap: 'wrap', marginTop: 20 },
  desktopPlayButton: { flexGrow: 0, flexShrink: 0, flexBasis: 132, width: 132 },
  mobilePlayButton: { flex: 1 },

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
