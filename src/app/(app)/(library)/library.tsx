import { registerAccountCleanup } from '@/services/account-lifecycle';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ArtworkImage from '@/components/artwork-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from '@/components/app-symbol';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Platform,
  useWindowDimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import { useMainHeaderScroll } from '@/hooks/use-main-header-scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadFailure from '@/components/load-failure';
import GlassPressable from '@/components/glass-pressable';
import LiquidSearchField from '@/components/liquid-search-field';
import MainHeaderOverlay, {
  MainHeaderSpacer,
} from '@/components/main-header-overlay';
import { CollectionPlayingOverlay } from '@/components/now-playing-artwork';
import PlaylistCover from '@/components/playlist-cover';
import MainNativeHeader from '@/components/main-native-header';
import MainScreenBackground from '@/components/main-screen-background';
import { useAuth } from '@/providers/auth-provider';
import { useDownloads } from '@/providers/download-provider';
import { useNetwork } from '@/providers/network-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref, useDetailRoutes } from '@/services/action-sheet';
import {
  CrimsonArtist,
  CrimsonPlaylist,
  LibraryFeed,
  loadLibraryFeed,
  readLocalListeningEvents,
  readOfflineData,
} from '@/services/music';
import {
  buildLibraryCollection,
  filterLibraryCollection,
  type LibraryCollectionItem,
  type LibraryFilter,
  type LibrarySort,
} from '@/services/library-collection';
import { subscribeToLibraryRefresh } from '@/services/navigation-events';

const defaultArtwork = require('@/assets/images/home/default-song.webp');
const defaultArtist = require('@/assets/images/home/default-artist.webp');
const favoritesArtwork = require('@/assets/images/onboarding/favorites.webp');
const emptyFeed: LibraryFeed = {
  playlists: [],
  likedPlaylists: [],
  followedArtists: [],
};
type LibraryLayout = 'list' | 'grid';
type LibraryRow = { key: string; items: LibraryCollectionItem[] };
const AnimatedFlatList = Reanimated.createAnimatedComponent(
  FlatList<LibraryRow>,
);
const feedFreshness = new Map<string, number>();
registerAccountCleanup(async (uid) => {
  await AsyncStorage.removeItem(`crimson:library-view:${uid}`);
  feedFreshness.delete(uid);
});
const emptyCollection = buildLibraryCollection(emptyFeed, []);

export default function LibraryScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  const [availableWidth, setAvailableWidth] = useState(0);
  const contentWidth = Math.min(1440, availableWidth || width - 280) - 56;
  const gridColumns = desktop ? Math.max(3, Math.min(7, Math.floor(contentWidth / 182))) : 2;
  const gridWidth = desktop ? Math.floor((contentWidth - 16 * (gridColumns - 1)) / gridColumns) : undefined;
  const { artistHref, favoritesHref, playlistHref } = useDetailRoutes();
  const insets = useSafeAreaInsets();
  const headerScroll = useMainHeaderScroll();
  const { user } = useAuth();
  const uid = user?.uid;
  const { isOffline } = useNetwork();
  const downloads = useDownloads();
  const { colors, reduceMotion, performanceMode } = useAppSettings();
  const [collection, setCollection] = useState<{
    uid?: string;
    items: LibraryCollectionItem[];
  }>({ uid, items: emptyCollection });
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [loading, setLoading] = useState(Boolean(uid));
  const [layout, setLayout] = useState<LibraryLayout>(desktop ? 'grid' : 'list');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [sort, setSort] = useState<LibrarySort>('recent');
  const [loadError, setLoadError] = useState(false);
  const preferencesKey = `crimson:library-view:${uid || 'guest'}`;
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(preferencesKey)
      .then((stored) => {
        if (!active) return;
        let value: { layout?: string; sort?: string } = {};
        try {
          value = stored ? JSON.parse(stored) : {};
        } catch {
          /* Restore defaults if corrupt. */
        }
        setLayout(value?.layout === 'grid' ? 'grid' : value?.layout === 'list' ? 'list' : desktop ? 'grid' : 'list');
        setSort(value?.sort === 'title' ? 'title' : 'recent');
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [desktop, preferencesKey]);
  const saveView = (nextLayout: LibraryLayout, nextSort: LibrarySort) => {
    setLayout(nextLayout);
    setSort(nextSort);
    void AsyncStorage.setItem(
      preferencesKey,
      JSON.stringify({ layout: nextLayout, sort: nextSort }),
    ).catch(() => undefined);
  };
  const reloadRequest = useRef(0);

  const reload = useCallback(
    async (force = false) => {
      const request = ++reloadRequest.current;
      setLoadError(false);
      if (!uid) {
        setCollection({ uid, items: emptyCollection });
        setLoading(false);
        return;
      }
      try {
        const [cached, events] = await Promise.all([
          readOfflineData<LibraryFeed>(`library:${uid}`),
          readLocalListeningEvents(uid),
        ]);
        if (request !== reloadRequest.current) return;
        if (cached) {
          setCollection({ uid, items: buildLibraryCollection(cached, events) });
          setLoading(false);
        }
        if (
          cached &&
          (isOffline ||
            (!force && Date.now() - (feedFreshness.get(uid) || 0) < 30_000))
        )
          return;
        const feed = await loadLibraryFeed(uid, { offlineOnly: isOffline });
        if (request === reloadRequest.current) {
          setCollection({ uid, items: buildLibraryCollection(feed, events) });
          feedFreshness.set(uid, Date.now());
        }
      } catch {
        if (request === reloadRequest.current) setLoadError(true);
      } finally {
        if (request === reloadRequest.current) setLoading(false);
      }
    },
    [isOffline, uid],
  );

  useFocusEffect(
    useCallback(() => {
      void reload(false);
      return () => {
        reloadRequest.current += 1;
      };
    }, [reload]),
  );

  useEffect(() => {
    const unsubscribe = subscribeToLibraryRefresh(() => void reload(true));
    return unsubscribe;
  }, [reload]);

  const visible = useMemo(
    () =>
      filterLibraryCollection(
        collection.uid === uid ? collection.items : emptyCollection,
        query,
        {
          filter,
          sort,
          isOffline: (item) =>
            item.kind === 'favorites'
              ? downloads.hasCollectionOfflineSongs('favorites')
              : item.kind === 'playlist'
                ? downloads.hasCollectionOfflineSongs(
                    `playlist:${item.playlist.id}`,
                  ) || item.playlist.songs.some(downloads.isDownloaded)
                : downloads.downloadedSongs.some(
                    (song) => song.artistId === item.artist.id,
                  ),
        },
      ),
    [collection, downloads, filter, query, sort, uid],
  );
  const rows = useMemo<LibraryRow[]>(() => {
    const columns = layout === 'grid' ? gridColumns : 1;
    return Array.from(
      { length: Math.ceil(visible.length / columns) },
      (_, index) => {
        const items = visible.slice(index * columns, (index + 1) * columns);
        return { key: items[0].key, items };
      },
    );
  }, [gridColumns, layout, visible]);

  const collectionNode = (item: LibraryCollectionItem) => {
    if (item.kind === 'favorites') {
      return (
        <LibraryItem
          key={item.key}
          downloadCollectionKey="favorites"
          imageSource={favoritesArtwork}
          layout={layout}
          desktop={desktop}
          gridWidth={gridWidth}
          onPress={() => router.push(favoritesHref())}
          subtitle="Simply yours"
          title="Favorites"
        />
      );
    }
    if (item.kind === 'artist') {
      const { artist } = item;
      return (
        <LibraryItem
          key={item.key}
          artist={artist}
          layout={layout}
          desktop={desktop}
          gridWidth={gridWidth}
          onPress={() => router.push(artistHref(artist.id))}
          onLongPress={() =>
            router.push(
              actionSheetHref({
                type: 'artist',
                id: artist.id,
                title: artist.name,
                subtitle: `${artist.followers} followers`,
                image: artist.imageSmall || artist.image,
              }),
            )
          }
          subtitle={`${artist.followers} followers`}
          title={artist.name}
        />
      );
    }
    const { playlist, owned } = item;
    return (
      <LibraryItem
        key={item.key}
        layout={layout}
        desktop={desktop}
        gridWidth={gridWidth}
        onPress={() =>
          router.push(
            playlistHref(playlist.id, owned, playlist.source, playlist.title),
          )
        }
        onLongPress={() =>
          router.push(
            actionSheetHref({
              type: 'playlist',
              id: playlist.id,
              title: playlist.title,
              subtitle: playlist.artists,
              image: playlist.imageSmall || playlist.image,
              coverImages: playlist.coverImages,
              source: playlist.source,
            }),
          )
        }
        playlist={playlist}
        subtitle={playlist.artists}
        title={playlist.title}
      />
    );
  };

  return (
    <MainScreenBackground overlay={<MainHeaderOverlay title="Library" offset={headerScroll.offset} />}>
      <MainNativeHeader offset={headerScroll.offset} title="Library" />
      <AnimatedFlatList
        onLayout={({ nativeEvent: { layout: bounds } }) => setAvailableWidth(bounds.width)}
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
        contentContainerStyle={[
          styles.content,
          desktop && styles.desktopContent,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 150 },
        ]}
        ListHeaderComponent={
          <>
            <MainHeaderSpacer title="Library" />
            <View style={[styles.headerActions, desktop && styles.desktopHeaderActions]}>
              <Reanimated.View
                layout={
                  desktop || reduceMotion || performanceMode
                    ? undefined
                    : LinearTransition.duration(220)
                }
                style={styles.searchField}
              >
                <LiquidSearchField
                  placeholder="Search library"
                  value={query}
                  onChangeText={setQuery}
                  onFocusChange={setSearchFocused}
                  stableLayout={desktop}
                />
              </Reanimated.View>
              {desktop || !searchFocused ? (
                <>
                  <GlassPressable
                    accessibilityLabel={
                      layout === 'list'
                        ? 'Show library as a grid'
                        : 'Show library as a list'
                    }
                    shape="circle"
                    height={52}
                    onPress={() =>
                      saveView(layout === 'list' ? 'grid' : 'list', sort)
                    }
                    style={[
                      styles.headerButton,
                      { backgroundColor: colors.controlSurface },
                    ]}
                    contentStyle={styles.headerButtonContent}
                  >
                    <SymbolView
                      name={
                        layout === 'list' ? 'square.grid.2x2' : 'list.bullet'
                      }
                      size={17}
                      tintColor={colors.text}
                      weight="semibold"
                    />
                  </GlassPressable>
                  <GlassPressable
                    accessibilityLabel="Create a playlist"
                    shape="circle"
                    height={52}
                    onPress={() =>
                      router.push('/(app)/(library)/create-playlist')
                    }
                    style={[
                      styles.headerButton,
                      { backgroundColor: colors.controlSurface },
                    ]}
                    contentStyle={styles.headerButtonContent}
                  >
                    <SymbolView
                      name="plus"
                      size={17}
                      tintColor={colors.text}
                      weight="bold"
                    />
                  </GlassPressable>
                </>
              ) : null}
            </View>
            {desktop || !searchFocused ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -20 }}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 14 }}
              >
                {(['all', 'playlists', 'artists', 'downloaded'] as const).filter(
                  (value) => downloads.supported || value !== 'downloaded',
                ).map(
                  (value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: filter === value }}
                      onPress={() => setFilter(value)}
                      style={[
                        styles.filterPill,
                        {
                          backgroundColor:
                            filter === value
                              ? colors.accentSoft
                              : colors.controlSurface,
                          borderColor:
                            filter === value ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            filter === value
                              ? colors.accent
                              : colors.secondaryText,
                          fontSize: 13,
                          fontWeight: '600',
                        }}
                      >
                        {value === 'all'
                          ? 'All'
                          : value === 'playlists'
                            ? 'Playlists'
                            : value === 'artists'
                              ? 'Artists'
                              : 'Downloaded'}
                      </Text>
                    </Pressable>
                  ),
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Sort library by ${sort === 'recent' ? 'title' : 'recently played'}`}
                  onPress={() =>
                    saveView(layout, sort === 'recent' ? 'title' : 'recent')
                  }
                  style={[styles.filterPill, { borderColor: colors.border }]}
                >
                  <SymbolView
                    name="arrow.up.arrow.down"
                    size={13}
                    tintColor={colors.secondaryText}
                  />
                  <Text style={{ color: colors.secondaryText, fontSize: 13 }}>
                    {sort === 'recent' ? 'Recent' : 'A–Z'}
                  </Text>
                </Pressable>
              </ScrollView>
            ) : null}
            {loadError ? (
              <LoadFailure
                title="Library refresh unavailable"
                message="Showing saved items where available. Check your connection to refresh."
                onRetry={() => void reload(true)}
              />
            ) : null}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              color={colors.accent}
              size="large"
              style={styles.loader}
            />
          ) : (
            <EmptyLine
              text={
                filter === 'downloaded'
                  ? 'Saved music will appear here when available offline.'
                  : 'No items match your search.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <View
            style={
              layout === 'grid'
                ? [styles.gridItems, desktop && styles.desktopGridItems, { marginBottom: 12 }]
                : { marginBottom: 6 }
            }
          >
            {item.items.map(collectionNode)}
          </View>
        )}
      />

    </MainScreenBackground>
  );
}

function LibraryItem({
  artist,
  desktop,
  gridWidth,
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
  desktop?: boolean;
  gridWidth?: number;
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
  const [hovered, setHovered] = useState(false);
  const downloads = useDownloads();
  const sourceName = playlist?.title || artist?.name || title;
  const image = artist?.imageSmall || artist?.image;
  const collectionKey =
    downloadCollectionKey || (playlist ? `playlist:${playlist.id}` : '');
  const collectionHasOfflineSongs = Boolean(
    (collectionKey && downloads.hasCollectionOfflineSongs(collectionKey)) ||
      playlist?.songs.some((trackId) => downloads.isDownloaded(trackId)),
  );
  const collectionDownloaded = Boolean(
    (downloadCollectionKey &&
      downloads.isCollectionDownloaded(downloadCollectionKey)) ||
      (playlist &&
        (downloads.isCollectionDownloaded(`playlist:${playlist.id}`) ||
          (playlist.songs.length &&
            playlist.songs.every((trackId) =>
              downloads.isDownloaded(trackId),
            )))),
  );

  const artwork = (borderRadius: number, spectrumSize: number) =>
    playlist ? (
      <PlaylistCover
        borderRadius={borderRadius}
        playlist={playlist}
        style={StyleSheet.absoluteFill}
      />
    ) : (
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius, backgroundColor: colors.controlSurface },
          styles.artworkClip,
        ]}
      >
        <ArtworkImage
          artwork={artist?.artwork}
          fallbackSource={imageSource || (artist ? defaultArtist : defaultArtwork)}
          contentFit="cover"
          source={
            image
              ? { uri: image }
              : imageSource || (artist ? defaultArtist : defaultArtwork)
          }
          style={StyleSheet.absoluteFill}
        />
        <CollectionPlayingOverlay
          sourceName={sourceName}
          spectrumSize={spectrumSize}
        />
      </View>
    );

  if (layout === 'grid') {
    const card = (
      <Pressable
        accessibilityLabel={`Open ${title}`}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        delayLongPress={350}
        onLongPress={onLongPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.gridItem,
          desktop && [styles.desktopGridItem, { width: gridWidth }],
          desktop && hovered && { backgroundColor: colors.controlSurface },
          pressed && styles.itemPressed,
          pressed && !reduceMotion && styles.itemPressedScale,
        ]}
      >
        <View
          style={[
            styles.gridArtwork,
            { backgroundColor: colors.controlSurface },
            artist && styles.roundGridArtwork,
          ]}
        >
          {artwork(artist ? 999 : desktop ? 12 : 18, 48)}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.gridArtworkBorder,
              { borderColor: colors.border },
              artist && styles.roundGridArtwork,
            ]}
          />
          {collectionHasOfflineSongs ? (
            <View
              style={[styles.downloadBadge, { backgroundColor: colors.accent }]}
            >
              <SymbolView
                name={collectionDownloaded ? 'checkmark' : 'arrow.down'}
                size={11}
                tintColor="#FFFFFF"
                weight="bold"
              />
            </View>
          ) : null}
        </View>

        <View
          pointerEvents="none"
          style={[styles.gridCopy, artist && styles.artistGridCopy]}
        >
          <Text
            numberOfLines={1}
            style={[styles.gridTitle, { color: colors.text }]}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.gridSubtitle, { color: colors.secondaryText }]}
          >
            {subtitle}
          </Text>
        </View>
      </Pressable>
    );
    return desktop ? <View style={{ width: gridWidth, position: 'relative' }}>
      {card}
        {onLongPress ? <Pressable
          accessibilityRole="button" accessibilityLabel={`More options for ${title}`}
          onPress={(event) => { event.stopPropagation(); onLongPress(); }}
          style={[styles.desktopMenu, { backgroundColor: colors.elevated }]}>
          <SymbolView name="ellipsis" size={18} tintColor={colors.text} />
        </Pressable> : null}
    </View> : card;
  }

  if (desktop) {
    return (
      <View style={[styles.desktopListRow, hovered && { backgroundColor: colors.controlSurface }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`}
          onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
          onPress={onPress} onLongPress={onLongPress} style={styles.desktopListMain}>
          <View style={[styles.listArtwork, artist && styles.roundListArtwork]}>{artwork(artist ? 23 : 9, 34)}</View>
          <View style={styles.listCopy}>
            <Text numberOfLines={1} style={[styles.listTitle, { color: colors.text }]}>{title}</Text>
            <Text numberOfLines={1} style={[styles.listSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text>
          </View>
          <Text style={[styles.desktopItemType, { color: colors.secondaryText }]}>{artist ? 'Artist' : 'Playlist'}</Text>
        </Pressable>
        {onLongPress ? <Pressable accessibilityRole="button" accessibilityLabel={`More options for ${title}`}
          onPress={onLongPress} style={styles.desktopListMenu}>
          <SymbolView name="ellipsis" size={20} tintColor={colors.secondaryText} />
        </Pressable> : <View style={styles.desktopListMenu} />}
      </View>
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
      contentStyle={styles.listItemContent}
    >
      <View
        style={[
          styles.listArtwork,
          { backgroundColor: colors.controlSurface },
          artist && styles.roundListArtwork,
        ]}
      >
        {artwork(artist ? 23 : 9, 34)}
      </View>
      <View style={styles.listCopy}>
        <Text
          numberOfLines={1}
          style={[styles.listTitle, { color: colors.text }]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.listSubtitle, { color: colors.secondaryText }]}
        >
          {subtitle}
        </Text>
      </View>
      {collectionHasOfflineSongs ? (
        <SymbolView
          name={
            collectionDownloaded
              ? 'checkmark.circle.fill'
              : 'icloud.and.arrow.down.fill'
          }
          size={18}
          tintColor={colors.accent}
        />
      ) : null}
      <SymbolView
        name="chevron.right"
        size={15}
        tintColor={colors.secondaryText}
        weight="semibold"
      />
    </GlassPressable>
  );
}

function EmptyLine({ text }: { text: string }) {
  const { colors } = useAppSettings();
  return (
    <Text style={[styles.emptyLine, { color: colors.secondaryText }]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  desktopContent: { paddingHorizontal: 28, width: '100%', maxWidth: 1440, alignSelf: 'center' },
  desktopHeaderActions: { maxWidth: 640, marginBottom: 18 },
  desktopGridItems: { justifyContent: 'flex-start', columnGap: 16, rowGap: 16 },
  desktopGridItem: { padding: 8, borderRadius: 12 },
  desktopMenu: { position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  desktopListRow: { flexDirection: 'row', alignItems: 'center', minHeight: 66, borderRadius: 8, paddingHorizontal: 10 },
  desktopListMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  desktopItemType: { width: 100, fontSize: 13 },
  desktopListMenu: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },

  content: { paddingHorizontal: 20 },
  filterPill: {
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  searchField: { flex: 1, minWidth: 0 },
  loader: { marginTop: 90 },
  headerActions: {
    marginTop: 4,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: { width: 52, flexShrink: 0 },
  headerButtonContent: { alignItems: 'center', justifyContent: 'center' },
  listItem: { backgroundColor: 'transparent', borderWidth: 0 },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  listArtwork: { width: 46, height: 46, overflow: 'hidden', borderRadius: 9 },
  roundListArtwork: { borderRadius: 23 },
  listCopy: { flex: 1, minWidth: 0 },
  listTitle: { color: '#DCD6F7', fontSize: 16, fontWeight: '600' },
  listSubtitle: { marginTop: 1, color: '#8A85A1', fontSize: 13 },
  gridItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  gridItem: { width: '48.3%' },
  gridArtwork: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: 18,
  },
  gridArtworkBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
  },
  roundGridArtwork: { borderRadius: 999 },
  artworkClip: { overflow: 'hidden' },
  gridCopy: { paddingTop: 9, paddingBottom: 6 },
  artistGridCopy: { alignItems: 'center' },
  downloadBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  gridTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  gridSubtitle: { marginTop: 2, color: 'rgba(239,233,247,0.72)', fontSize: 12 },
  itemPressed: { opacity: 0.8 },
  itemPressedScale: { transform: [{ scale: 0.98 }] },
  emptyLine: { color: '#777188', fontSize: 13, paddingVertical: 17 },
});
