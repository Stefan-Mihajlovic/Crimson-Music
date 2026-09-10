import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, FlatList, StyleSheet, Text, View } from 'react-native';
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import { useMainHeaderScroll } from '@/hooks/use-main-header-scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassPressable from '@/components/glass-pressable';
import LiquidSearchField from '@/components/liquid-search-field';
import MainHeaderOverlay, { MainHeaderSpacer } from '@/components/main-header-overlay';
import { CollectionPlayingOverlay } from '@/components/now-playing-artwork';
import PlaylistCover from '@/components/playlist-cover';
import MainNativeHeader from '@/components/main-native-header';
import MainScreenBackground from '@/components/main-screen-background';
import { useAuth } from '@/providers/auth-provider';
import { useDownloads } from '@/providers/download-provider';
import { useNetwork } from '@/providers/network-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref, useDetailRoutes } from '@/services/action-sheet';
import { CrimsonArtist, CrimsonPlaylist, LibraryFeed, loadLibraryFeed, readLocalListeningEvents } from '@/services/music';
import { buildLibraryCollection, filterLibraryCollection, type LibraryCollectionItem } from '@/services/library-collection';
import { subscribeToLibraryRefresh } from '@/services/navigation-events';

const defaultArtwork = require('@/assets/images/home/default-song.webp');
const defaultArtist = require('@/assets/images/home/default-artist.webp');
const favoritesArtwork = require('@/assets/images/onboarding/favorites.webp');
const emptyFeed: LibraryFeed = { playlists: [], likedPlaylists: [], followedArtists: [] };
type LibraryLayout = 'list' | 'grid';
type LibraryRow = { key: string; items: LibraryCollectionItem[] };
const AnimatedFlatList = Reanimated.createAnimatedComponent(FlatList<LibraryRow>);
const emptyCollection = buildLibraryCollection(emptyFeed, []);

export default function LibraryScreen() {
  const router = useRouter();
  const { artistHref, favoritesHref, playlistHref } = useDetailRoutes();
  const insets = useSafeAreaInsets();
  const headerScroll = useMainHeaderScroll();
  const { user } = useAuth();
  const uid = user?.uid;
  const { isOffline } = useNetwork();
  const { colors, reduceMotion, performanceMode } = useAppSettings();
  const [collection, setCollection] = useState<{ uid?: string; items: LibraryCollectionItem[] }>({ uid, items: emptyCollection });
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [loading, setLoading] = useState(Boolean(uid));
  const [layout, setLayout] = useState<LibraryLayout>('list');
  const reloadRequest = useRef(0);

  const reload = useCallback(async (showError: boolean) => {
    const request = ++reloadRequest.current;
    if (!uid) {
      setCollection({ uid, items: emptyCollection });
      setLoading(false);
      return;
    }
    try {
      const [nextFeed, events] = await Promise.all([
        loadLibraryFeed(uid, { offlineOnly: isOffline }),
        readLocalListeningEvents(uid),
      ]);
      if (request === reloadRequest.current) setCollection({ uid, items: buildLibraryCollection(nextFeed, events) });
    } catch {
      if (showError && request === reloadRequest.current) Alert.alert('Library is unavailable', 'Check your connection and try again.');
    } finally {
      if (request === reloadRequest.current) setLoading(false);
    }
  }, [isOffline, uid]);

  useFocusEffect(useCallback(() => {
    void reload(true);
    return () => {
      reloadRequest.current += 1;
    };
  }, [reload]));

  useEffect(() => {
    const unsubscribe = subscribeToLibraryRefresh(() => void reload(false));
    return unsubscribe;
  }, [reload]);

  const visible = useMemo(
    () => filterLibraryCollection(collection.uid === uid ? collection.items : emptyCollection, query),
    [collection, query, uid],
  );
  const rows = useMemo<LibraryRow[]>(() => {
    const columns = layout === 'grid' ? 2 : 1;
    return Array.from({ length: Math.ceil(visible.length / columns) }, (_, index) => {
      const items = visible.slice(index * columns, (index + 1) * columns);
      return { key: items[0].key, items };
    });
  }, [layout, visible]);

  const collectionNode = (item: LibraryCollectionItem) => {
    if (item.kind === 'favorites') {
      return <LibraryItem key={item.key} downloadCollectionKey="favorites" imageSource={favoritesArtwork} layout={layout}
        onPress={() => router.push(favoritesHref())} subtitle="Simply yours" title="Favorites" />;
    }
    if (item.kind === 'artist') {
      const { artist } = item;
      return <LibraryItem key={item.key} artist={artist} layout={layout}
        onPress={() => router.push(artistHref(artist.id))}
        onLongPress={() => router.push(actionSheetHref({ type: 'artist', id: artist.id, title: artist.name, subtitle: `${artist.followers} followers`, image: artist.imageSmall || artist.image }))}
        subtitle={`${artist.followers} followers`} title={artist.name} />;
    }
    const { playlist, owned } = item;
    return <LibraryItem key={item.key} layout={layout}
      onPress={() => router.push(playlistHref(playlist.id, owned, playlist.source, playlist.title))}
      onLongPress={() => router.push(actionSheetHref({ type: 'playlist', id: playlist.id, title: playlist.title, subtitle: playlist.artists, image: playlist.imageSmall || playlist.image, coverImages: playlist.coverImages, source: playlist.source }))}
      playlist={playlist} subtitle={playlist.artists} title={playlist.title} />;
  };

  return (
    <MainScreenBackground>
      <MainNativeHeader offset={headerScroll.offset} title="Library" />
      <AnimatedFlatList
        data={loading ? [] : rows}
        keyExtractor={(item) => item.key}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}

        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 150 }]}
        ListHeaderComponent={<>
          <MainHeaderSpacer />
          <View style={styles.headerActions}>
            <Reanimated.View
              layout={reduceMotion || performanceMode ? undefined : LinearTransition.duration(220)}
              style={styles.searchField}>
              <LiquidSearchField placeholder="Search library" value={query} onChangeText={setQuery} onFocusChange={setSearchFocused} />
            </Reanimated.View>
            {!searchFocused ? <><GlassPressable
              accessibilityLabel={layout === 'list' ? 'Show library as a grid' : 'Show library as a list'}
              shape="circle" height={52}
              onPress={() => setLayout((value) => value === 'list' ? 'grid' : 'list')}
              style={[styles.headerButton, { backgroundColor: colors.controlSurface }]} contentStyle={styles.headerButtonContent}>
              <SymbolView name={layout === 'list' ? 'square.grid.2x2' : 'list.bullet'} size={17} tintColor={colors.text} weight="semibold" />
            </GlassPressable>
            <GlassPressable
              accessibilityLabel="Create a playlist"
              shape="circle" height={52}
              onPress={() => router.push('/(app)/(library)/create-playlist')}
              style={[styles.headerButton, { backgroundColor: colors.controlSurface }]} contentStyle={styles.headerButtonContent}>
              <SymbolView name="plus" size={17} tintColor={colors.text} weight="bold" />
            </GlassPressable>
            </> : null}
          </View>
        </>}
        ListEmptyComponent={loading
          ? <ActivityIndicator color={colors.accent} size="large" style={styles.loader} />
          : <EmptyLine text="No items match your search." />}
        renderItem={({ item }) => (
          <View style={layout === 'grid' ? [styles.gridItems, { marginBottom: 12 }] : { marginBottom: 6 }}>
            {item.items.map(collectionNode)}
          </View>
        )}

      />
      <MainHeaderOverlay title="Library" offset={headerScroll.offset} />
    </MainScreenBackground>
  );
}

function LibraryItem({
  artist,
  downloadCollectionKey,
  imageSource,
  layout,
  onLongPress,
  onPress,
  playlist,
  subtitle,
  title,
}: {
  artist?: CrimsonArtist;
  downloadCollectionKey?: string;
  imageSource?: number;
  layout: LibraryLayout;
  onLongPress?: () => void;
  onPress: () => void;
  playlist?: CrimsonPlaylist;
  subtitle: string;
  title: string;
}) {
  const { colors, reduceMotion } = useAppSettings();
  const downloads = useDownloads();
  const sourceName = playlist?.title || artist?.name || title;
  const image = artist?.imageSmall || artist?.image;
  const collectionKey = downloadCollectionKey || (playlist ? `playlist:${playlist.id}` : '');
  const collectionHasOfflineSongs = Boolean(
    (collectionKey && downloads.hasCollectionOfflineSongs(collectionKey))
    || playlist?.songs.some((trackId) => downloads.isDownloaded(trackId)),
  );
  const collectionDownloaded = Boolean(
    (downloadCollectionKey && downloads.isCollectionDownloaded(downloadCollectionKey))
    || (playlist && (
      downloads.isCollectionDownloaded(`playlist:${playlist.id}`)
      || (playlist.songs.length && playlist.songs.every((trackId) => downloads.isDownloaded(trackId)))
    )),
  );

  const artwork = (borderRadius: number, spectrumSize: number) => playlist ? (
    <PlaylistCover borderRadius={borderRadius} playlist={playlist} style={StyleSheet.absoluteFill} />
  ) : (
    <View style={[StyleSheet.absoluteFill, { borderRadius, backgroundColor: colors.controlSurface }, styles.artworkClip]}>
      <Image
        contentFit="cover"
        source={image ? { uri: image } : imageSource || (artist ? defaultArtist : defaultArtwork)}
        style={StyleSheet.absoluteFill}
      />
      <CollectionPlayingOverlay sourceName={sourceName} spectrumSize={spectrumSize} />
    </View>
  );

  if (layout === 'grid') {
    return (
      <Pressable
        accessibilityLabel={`Open ${title}`}
        accessibilityRole="button"
        delayLongPress={350}
        onLongPress={onLongPress}
        onPress={onPress}
        style={({ pressed }) => [styles.gridItem, pressed && styles.itemPressed, pressed && !reduceMotion && styles.itemPressedScale]}>
        <View style={[styles.gridArtwork, { backgroundColor: colors.controlSurface }, artist && styles.roundGridArtwork]}>
          {artwork(artist ? 999 : 18, 48)}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.gridArtworkBorder, { borderColor: colors.border }, artist && styles.roundGridArtwork]} />
          {collectionHasOfflineSongs ? (
            <View style={[styles.downloadBadge, { backgroundColor: colors.accent }]}>
              <SymbolView name={collectionDownloaded ? 'checkmark' : 'arrow.down'} size={11} tintColor="#FFFFFF" weight="bold" />
            </View>
          ) : null}
        </View>
        <View pointerEvents="none" style={[styles.gridCopy, artist && styles.artistGridCopy]}>
          <Text numberOfLines={1} style={[styles.gridTitle, { color: colors.text }]}>{title}</Text>
          <Text numberOfLines={1} style={[styles.gridSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <GlassPressable
      accessibilityLabel={`Open ${title}`}
      cornerRadius={16}
      delayLongPress={350}
      height={62}
      onLongPress={onLongPress || onPress}
      onPress={onPress}
      style={styles.listItem}
      contentStyle={styles.listItemContent}>
      <View style={[styles.listArtwork, { backgroundColor: colors.controlSurface }, artist && styles.roundListArtwork]}>
        {artwork(artist ? 23 : 9, 34)}
      </View>
      <View style={styles.listCopy}>
        <Text numberOfLines={1} style={[styles.listTitle, { color: colors.text }]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.listSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text>
      </View>
      {collectionHasOfflineSongs
        ? <SymbolView name={collectionDownloaded ? 'checkmark.circle.fill' : 'icloud.and.arrow.down.fill'} size={18} tintColor={colors.accent} />
        : null}
      <SymbolView name="chevron.right" size={15} tintColor={colors.secondaryText} weight="semibold" />
    </GlassPressable>
  );
}

function EmptyLine({ text }: { text: string }) {
  const { colors } = useAppSettings();
  return <Text style={[styles.emptyLine, { color: colors.secondaryText }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  searchField: { flex: 1, minWidth: 0 },
  loader: { marginTop: 90 },
  headerActions: { marginTop: 4, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerButton: { width: 52, flexShrink: 0 },
  headerButtonContent: { alignItems: 'center', justifyContent: 'center' },
  listItem: { backgroundColor: 'transparent', borderWidth: 0 },
  listItemContent: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingLeft: 8, paddingRight: 18 },
  listArtwork: { width: 46, height: 46, overflow: 'hidden', borderRadius: 9 },
  roundListArtwork: { borderRadius: 23 },
  listCopy: { flex: 1, minWidth: 0 },
  listTitle: { color: '#DCD6F7', fontSize: 16, fontWeight: '600' },
  listSubtitle: { marginTop: 1, color: '#8A85A1', fontSize: 13 },
  gridItems: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  gridItem: { width: '48.3%' },
  gridArtwork: { width: '100%', aspectRatio: 1, overflow: 'hidden', borderRadius: 18 },
  gridArtworkBorder: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18 },
  roundGridArtwork: { borderRadius: 999 },
  artworkClip: { overflow: 'hidden' },
  gridCopy: { paddingTop: 9, paddingBottom: 6 },
  artistGridCopy: { alignItems: 'center' },
  downloadBadge: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  gridTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  gridSubtitle: { marginTop: 2, color: 'rgba(239,233,247,0.72)', fontSize: 12 },
  itemPressed: { opacity: 0.8 },
  itemPressedScale: { transform: [{ scale: 0.98 }] },
  emptyLine: { color: '#777188', fontSize: 13, paddingVertical: 17 },
});
