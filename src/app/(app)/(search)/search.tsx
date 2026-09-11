import { registerAccountCleanup } from '@/services/account-lifecycle';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image, ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SymbolView } from '@/components/app-symbol';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useMainHeaderScroll } from '@/hooks/use-main-header-scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthFieldHandle } from '@/components/auth-field.types';
import GlassPressable from '@/components/glass-pressable';
import LiquidSearchField from '@/components/liquid-search-field';
import LoadFailure from '@/components/load-failure';
import MainHeaderOverlay, {
  MainHeaderSpacer,
} from '@/components/main-header-overlay';
import MainNativeHeader from '@/components/main-native-header';
import MainScreenBackground from '@/components/main-screen-background';
import SongListRow from '@/components/song-list-row';
import SearchDiscovery from '@/components/search-discovery';
import { BROWSE_TILE_GAP, BROWSE_TILE_HEIGHT, BROWSE_TILE_RADIUS, browseTileWidth } from '@/styles/browse-tiles';
import { useAuth } from '@/providers/auth-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref, useDetailRoutes } from '@/services/action-sheet';
import {
  AudiusSearchKind,
  getAudiusEvents,
  searchAudiusPage,
} from '@/services/audius';
import {
  CrimsonArtist,
  CrimsonCategory,
  CrimsonEvent,
  CrimsonPlaylist,
  CrimsonSong,
  DiscoveryCatalog,
  loadDiscoveryCatalog,
} from '@/services/music';
import {
  getSearchQuery,
  requestSearchQuery,
  subscribeToSearchFocus,
  subscribeToSearchQuery,
} from '@/services/navigation-events';

registerAccountCleanup(async (uid) => {
  await AsyncStorage.removeItem(`crimson:recent-searches:${uid}`);
});
const defaultSongImage = require('@/assets/images/home/default-song.webp');
const defaultArtistImage = require('@/assets/images/home/default-artist.webp');
type SearchFilter = 'all' | AudiusSearchKind | 'events';
type MixedSearchResult =
  | { kind: 'artist'; item: CrimsonArtist; score: number }
  | { kind: 'event'; item: CrimsonEvent; score: number }
  | { kind: 'playlist'; item: CrimsonPlaylist; score: number }
  | { kind: 'song'; item: CrimsonSong; score: number };
const filters: { id: SearchFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'songs', label: 'Songs' },
  { id: 'artists', label: 'Artists' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'events', label: 'Events' },
];
const emptyCatalog: DiscoveryCatalog = {
  songs: [],
  artists: [],
  playlists: [],
  categories: [],
  profiles: [],
  events: [],
};
const AnimatedList = Reanimated.createAnimatedComponent(
  FlatList<MixedSearchResult>,
);

export default function SearchScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  const routes = useDetailRoutes();
  const insets = useSafeAreaInsets();
  const headerScroll = useMainHeaderScroll();
  const { playSong } = usePlayer();
  const { colors } = useAppSettings();
  const { user } = useAuth();
  const [query, setQuery] = useState(getSearchQuery);
  const changeQuery = (value: string) => {
    if (Platform.OS === 'web') requestSearchQuery(value);
    else setQuery(value);
  };
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [catalog, setCatalog] = useState<DiscoveryCatalog>(emptyCatalog);
  const [resolvedQuery, setResolvedQuery] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState<SearchFilter>('all');
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0);
  const nextOffset = useRef(0);
  const pending = useRef(false);
  const searchFieldRef = useRef<AuthFieldHandle>(null);
  const recentKey = `crimson:recent-searches:${user?.uid || 'guest'}`;
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(recentKey)
      .then((value) => {
        let items: unknown = [];
        try {
          items = value ? JSON.parse(value) : [];
        } catch {
          /* Ignore malformed local history. */
        }
        if (active)
          setRecent(
            Array.isArray(items)
              ? items
                  .filter((item): item is string => typeof item === 'string')
                  .slice(0, 8)
              : [],
          );
      })
      .catch(() => {
        if (active) setRecent([]);
      });
    return () => {
      active = false;
    };
  }, [recentKey]);
  const rememberQuery = () => {
    const value = query.trim();
    if (value.length < 2) return;
    const next = [
      value,
      ...recent.filter(
        (item) => item.toLocaleLowerCase() !== value.toLocaleLowerCase(),
      ),
    ].slice(0, 8);
    setRecent(next);
    void AsyncStorage.setItem(recentKey, JSON.stringify(next)).catch(
      () => undefined,
    );
  };
  useEffect(() => {
    const token = ++request.current;
    const normalized = query.trim();
    const timer = setTimeout(
      async () => {
        setLoading(true);
        setError(false);
        setLoadingMore(false);
        setHasMore(false);
        pending.current = true;
        try {
          let next: DiscoveryCatalog;
          if (!normalized || filter === 'all')
            next = await loadDiscoveryCatalog(normalized);
          else if (filter === 'events')
            next = {
              ...emptyCatalog,
              events: await getAudiusEvents(30, normalized),
            };
          else {
            const page = await searchAudiusPage(normalized, filter, 0, 30);
            next = { ...emptyCatalog, [filter]: page.items };
            if (request.current === token) {
              nextOffset.current = page.nextOffset;
              setHasMore(page.hasMore);
            }
          }
          if (request.current === token) {
            setCatalog(next);
            setResolvedQuery(normalized);
            setResolvedFilter(filter);
          }
        } catch {
          if (request.current === token) {
            setCatalog(emptyCatalog);
            setResolvedQuery(normalized);
            setResolvedFilter(filter);
            setError(true);
          }
        } finally {
          if (request.current === token) {
            pending.current = false;
            setLoading(false);
          }
        }
      },
      normalized ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      request.current += 1;
    };
  }, [query, filter, retry]);
  useEffect(
    () => subscribeToSearchFocus(() => searchFieldRef.current?.focus()),
    [],
  );
  useEffect(
    () =>
      subscribeToSearchQuery((nextQuery) => {
        setFilter('all');
        setQuery(nextQuery);
      }),
    [],
  );
  const loadMore = useCallback(async () => {
    if (
      pending.current ||
      loading ||
      !hasMore ||
      filter === 'all' ||
      filter === 'events' ||
      !query.trim() ||
      query.trim() !== resolvedQuery ||
      filter !== resolvedFilter
    )
      return;
    const token = request.current;
    pending.current = true;
    setLoadingMore(true);
    setError(false);
    try {
      const page = await searchAudiusPage(
        query,
        filter,
        nextOffset.current,
        30,
      );
      if (request.current !== token) return;
      nextOffset.current = page.nextOffset;
      setHasMore(page.hasMore);
      setCatalog((current) => ({
        ...current,
        [filter]: Array.from(
          new Map(
            [...current[filter], ...page.items].map((item) => [item.id, item]),
          ).values(),
        ),
      }));
    } catch {
      if (request.current === token) setError(true);
    } finally {
      if (request.current === token) {
        pending.current = false;
        setLoadingMore(false);
      }
    }
  }, [filter, hasMore, loading, query, resolvedFilter, resolvedQuery]);
  const awaitingQuery =
    query.trim() !== resolvedQuery || filter !== resolvedFilter;
  const results = useMemo(
    () =>
      query.trim() && !awaitingQuery ? rankSearchResults(catalog, query) : [],
    [awaitingQuery, catalog, query],
  );
  const activate = (action: () => void) => {
    rememberQuery();
    action();
  };
  const renderResult = (result: MixedSearchResult) => {
    if (result.kind === 'song') {
      const song = result.item;
      return (
        <SongListRow
          song={song}
          onPress={() =>
            activate(() => playSong(song, catalog.songs, 'Search'))
          }
          onMenuPress={() =>
            activate(() =>
              router.push(
                actionSheetHref({
                  type: 'song',
                  id: song.id,
                  title: song.title,
                  subtitle: song.creator,
                  image: song.imageSmall || song.image,
                  artistId: song.artistId,
                  source: song.source,
                }),
              ),
            )
          }
        />
      );
    }
    if (result.kind === 'artist') {
      const artist = result.item;
      return (
        <SearchRow
          fallback={defaultArtistImage}
          icon="person.crop.circle"
          image={artist.imageSmall}
          title={artist.name}
          subtitle={`@${artist.handle} · Artist`}
          onPress={() =>
            activate(() => router.push(routes.artistHref(artist.id)))
          }
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
        />
      );
    }
    if (result.kind === 'playlist') {
      const playlist = result.item;
      return (
        <PlaylistResult
          playlist={playlist}
          onPress={() =>
            activate(() =>
              router.push(
                routes.playlistHref(
                  playlist.id,
                  false,
                  playlist.source,
                  playlist.title,
                ),
              ),
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
        />
      );
    }
    return (
      <EventResult
        event={result.item}
        onPress={() =>
          activate(() => router.push(routes.eventHref(result.item.id)))
        }
      />
    );
  };
  return (
    <MainScreenBackground overlay={<MainHeaderOverlay title="Search" offset={headerScroll.offset} />}>
      <MainNativeHeader offset={headerScroll.offset} title="Search" />
      <AnimatedList
        data={loading || awaitingQuery ? [] : results}
        keyExtractor={(result) => `${result.kind}:${result.item.id}`}
        initialNumToRender={12}
        windowSize={7}
        contentInsetAdjustmentBehavior="never"
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          desktop && styles.desktopContent,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 150 },
        ]}
        ListHeaderComponent={
          <>
            <MainHeaderSpacer title="Search" />
            {!desktop && <View style={styles.searchField}>
              <LiquidSearchField
                ref={searchFieldRef}
                placeholder="Songs, artists and playlists"
                value={query}
                onChangeText={changeQuery}
              />
            </View>}
            {!query.trim() ? <SearchDiscovery /> : null}
            {query.trim() ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.fullBleedCarousel}
                contentContainerStyle={styles.filters}
              >
                {filters.map((item) => (
                  <GlassPressable
                    key={item.id}
                    accessibilityLabel={`Show ${item.label} results`}
                    cornerRadius={18}
                    height={36}
                    onPress={() => setFilter(item.id)}
                    tintColor={
                      filter === item.id ? colors.accent : colors.controlSurface
                    }
                    contentStyle={styles.filterButtonContent}
                    style={[
                      styles.filterButton,
                      filter === item.id && { backgroundColor: colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        {
                          color:
                            filter === item.id
                              ? '#FFFFFF'
                              : colors.secondaryText,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </GlassPressable>
                ))}
              </ScrollView>
            ) : recent.length ? (
              <View style={[{ marginTop: 22, gap: 6 }, desktop && styles.desktopRecent]}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Recent searches
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear recent searches"
                    onPress={() => {
                      setRecent([]);
                      void AsyncStorage.removeItem(recentKey).catch(
                        () => undefined,
                      );
                    }}
                  >
                    <Text style={{ color: colors.accent, padding: 10 }}>
                      Clear
                    </Text>
                  </Pressable>
                </View>
                {recent.map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    onPress={() => {
                      setFilter('all');
                      changeQuery(item);
                    }}
                    style={{
                      minHeight: 44,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <SymbolView
                      name="clock.arrow.circlepath"
                      size={18}
                      tintColor={colors.secondaryText}
                    />
                    <Text style={{ color: colors.text, flex: 1 }}>{item}</Text>
                    <SymbolView
                      name="arrow.up.left"
                      size={14}
                      tintColor={colors.secondaryText}
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          loading || awaitingQuery ? (
            <ActivityIndicator
              color={colors.accent}
              size="large"
              style={styles.loader}
            />
          ) : error ? (
            <LoadFailure
              title="Search unavailable"
              onRetry={() => setRetry((value) => value + 1)}
            />
          ) : !query.trim() ? (
            <CategoryGrid
              categories={catalog.categories}
              onChoose={(category) =>
                router.push(routes.categoryHref(category.id))
              }
            />
          ) : (
            <EmptySearch
              title={query.trim().length < 2 ? 'Keep typing' : 'No matches'}
              body={
                query.trim().length < 2
                  ? 'Enter at least two characters.'
                  : `Try another name or a different filter for “${query.trim()}”.`
              }
            />
          )
        }
        renderItem={({ item, index }) => (
          <View style={{ marginTop: index === 0 ? 18 : 7 }}>
            {filter === 'all' && index === 0 ? (
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Top result
              </Text>
            ) : filter === 'all' && index === 1 ? (
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.text, marginTop: 10 },
                ]}
              >
                More results
              </Text>
            ) : null}
            {renderResult(item)}
          </View>
        )}
        ListFooterComponent={
          error && results.length ? (
            <LoadFailure
              title="Could not load more results"
              onRetry={() => void loadMore()}
            />
          ) : loadingMore ? (
            <ActivityIndicator color={colors.accent} style={{ padding: 20 }} />
          ) : hasMore && !awaitingQuery && !loading ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadMore()}
              style={{ padding: 20, alignItems: 'center' }}
            >
              <Text style={{ color: colors.accent }}>Load more</Text>
            </Pressable>
          ) : null
        }
        onEndReached={() => {
          if (!error) void loadMore();
        }}
        onEndReachedThreshold={0.4}
      />

    </MainScreenBackground>
  );
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function searchRelevance(
  query: string,
  primary: string,
  secondary = '',
  sourceIndex = 0,
) {
  const normalizedQuery = normalizeSearchValue(query);
  const normalizedPrimary = normalizeSearchValue(primary);
  const normalizedSecondary = normalizeSearchValue(secondary);
  if (!normalizedQuery) return 0;

  let score = 0;
  if (normalizedPrimary === normalizedQuery) score = 1_000;
  else if (normalizedPrimary.startsWith(normalizedQuery)) score = 820;
  else if (
    normalizedPrimary
      .split(/\s+/)
      .some((word) => word.startsWith(normalizedQuery))
  )
    score = 700;
  else if (normalizedPrimary.includes(normalizedQuery)) score = 590;

  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
  const primaryWords = normalizedPrimary.split(/\s+/).filter(Boolean);
  const matchingWords = queryWords.filter((word) =>
    primaryWords.some((candidate) => candidate.startsWith(word)),
  ).length;
  score += matchingWords * 70;

  if (normalizedSecondary === normalizedQuery) score += 390;
  else if (normalizedSecondary.startsWith(normalizedQuery)) score += 310;
  else if (normalizedSecondary.includes(normalizedQuery)) score += 220;

  // Preserve the provider's relevance ordering without letting one result
  // type monopolize the top of the combined list.
  return score - sourceIndex * 7;
}

function rankSearchResults(
  results: DiscoveryCatalog,
  query: string,
): MixedSearchResult[] {
  const ranked: MixedSearchResult[] = [
    ...results.songs.map((item, index) => ({
      kind: 'song' as const,
      item,
      score: searchRelevance(query, item.title, item.creator, index),
    })),
    ...results.artists.map((item, index) => ({
      kind: 'artist' as const,
      item,
      score: searchRelevance(query, item.name, item.handle, index),
    })),
    ...results.playlists.map((item, index) => ({
      kind: 'playlist' as const,
      item,
      score: searchRelevance(query, item.title, item.artists, index),
    })),
    ...results.events.map((item, index) => ({
      kind: 'event' as const,
      item,
      score: searchRelevance(query, item.title, item.hostName, index),
    })),
  ];
  return ranked.sort((left, right) => right.score - left.score);
}

function CategoryGrid({
  categories,
  onChoose,
}: {
  categories: CrimsonCategory[];
  onChoose: (category: CrimsonCategory) => void;
}) {
  const { colors, reduceMotion } = useAppSettings();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  const [contentWidth, setContentWidth] = useState(0);
  const columns = Math.max(3, Math.min(6, Math.floor((contentWidth || width - 360) / 190)));
  const cardWidth = desktop ? Math.floor(((contentWidth || width - 360) - 16 * (columns - 1)) / columns) : browseTileWidth(width);
  const [hovered, setHovered] = useState('');
  const eventCategory = categories.find((category) => category.id === 'events');
  const browseCategories = categories.filter(
    (category) => category.id !== 'events',
  );
  return (
    <View style={styles.categorySection}>
      <Text style={[styles.sectionTitle, styles.browseTitle, { color: colors.text }]}>
        Browse categories
      </Text>
      <View onLayout={({ nativeEvent: { layout } }) => setContentWidth(layout.width)} style={[styles.categoryGrid, desktop && styles.desktopCategoryGrid]}>
        {browseCategories.map((category) => (
          <Pressable
            key={category.id}
            onHoverIn={() => setHovered(category.id)}
            onHoverOut={() => setHovered('')}
            accessibilityRole="button"
            accessibilityLabel={`Browse ${category.name}`}
            onPress={() => onChoose(category)}
            style={({ pressed }) => [
              styles.categoryCard,
              { width: cardWidth },
              desktop && styles.desktopCategoryCard,
              desktop && hovered === category.id && { transform: [{ translateY: -3 }] },
              { backgroundColor: category.color },
              pressed && styles.categoryPressed,
              pressed && !reduceMotion && styles.categoryPressedScale,
            ]}
          >
            {category.localImage || category.imageSmall ? (
              <Image
                source={category.localImage || { uri: category.imageSmall }}
                contentFit="cover"
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <LinearGradient
              colors={[`${category.color}18`, `${category.color}E8`]}
              locations={[0.05, 1]}
              style={styles.categoryShade}
            />
            <Text numberOfLines={2} style={styles.categoryName}>
              {category.name}
            </Text>
            <SymbolView
              name="arrow.up.right"
              size={16}
              tintColor="#FFFFFF"
              weight="bold"
            />
          </Pressable>
        ))}
      </View>
      {eventCategory ? (
        <View style={styles.eventsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Events
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Browse Events"
            onPress={() => onChoose(eventCategory)}
            style={({ pressed }) => [
              styles.categoryCard,
              styles.eventCard,
              desktop && { maxWidth: 580, height: 150, borderRadius: 12 },
              { backgroundColor: eventCategory.color },
              pressed && styles.categoryPressed,
              pressed && !reduceMotion && styles.categoryPressedScale,
            ]}
          >
            {eventCategory.localImage || eventCategory.imageSmall ? (
              <Image
                source={
                  eventCategory.localImage || { uri: eventCategory.imageSmall }
                }
                contentFit="cover"
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <LinearGradient
              colors={[`${eventCategory.color}12`, `${eventCategory.color}E8`]}
              locations={[0.05, 1]}
              style={styles.categoryShade}
            />
            <Text style={styles.categoryName}>Events</Text>
            <SymbolView
              name="arrow.up.right"
              size={18}
              tintColor="#FFFFFF"
              weight="bold"
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function PlaylistResult({
  onLongPress,
  onPress,
  playlist,
}: {
  onLongPress: () => void;
  onPress: () => void;
  playlist: CrimsonPlaylist;
}) {
  return (
    <SearchRow
      image={playlist.imageSmall}
      fallback={defaultSongImage}
      title={playlist.title}
      subtitle={playlist.artists}
      icon="music.note.list"
      onPress={onPress}
      onLongPress={onLongPress}
    />
  );
}

function EventResult({
  event,
  onPress,
}: {
  event: CrimsonEvent;
  onPress: () => void;
}) {
  const deadline =
    event.endDate && Number.isFinite(Date.parse(event.endDate))
      ? `Ends ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(event.endDate))}`
      : 'Audius event';
  return (
    <SearchRow
      image={event.image || event.hostImage}
      fallback={defaultSongImage}
      title={event.title}
      subtitle={`${event.hostName} · ${deadline}`}
      icon="calendar"
      onPress={onPress}
    />
  );
}

function SearchRow({
  fallback,
  icon,
  image,
  onLongPress,
  onPress,
  subtitle,
  title,
}: {
  fallback: ImageSource;
  icon:
    | 'person.crop.circle'
    | 'play.fill'
    | 'music.note.list'
    | 'person.fill'
    | 'calendar';
  image: string;
  onLongPress?: () => void;
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  const { colors } = useAppSettings();
  return (
    <GlassPressable
      accessibilityLabel={`${title}, ${subtitle}`}
      cornerRadius={16}
      height={56}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.result}
      contentStyle={styles.resultContent}
    >
      <Image
        contentFit="cover"
        source={image ? { uri: image } : fallback}
        style={[
          styles.resultImage,
          icon === 'person.crop.circle' && { borderRadius: 21 },
        ]}
      />
      <View style={styles.resultCopy}>
        <Text
          numberOfLines={1}
          style={[styles.resultTitle, { color: colors.text }]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.resultSubtitle, { color: colors.secondaryText }]}
        >
          {subtitle}
        </Text>
      </View>
      <SymbolView name={icon} size={18} tintColor={colors.secondaryText} />
    </GlassPressable>
  );
}

function EmptySearch({ title, body }: { title: string; body: string }) {
  const { colors } = useAppSettings();
  return (
    <View style={styles.empty}>
      <SymbolView name="magnifyingglass" size={42} tintColor={colors.accent} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopContent: { paddingHorizontal: 28, width: '100%', maxWidth: 1440, alignSelf: 'center' },
  desktopRecent: { maxWidth: 600 },
  desktopCategoryGrid: { gap: 16 },
  desktopCategoryCard: { height: 136, borderRadius: 12, padding: 16 },
  screen: { flex: 1, backgroundColor: '#0E0D13' },
  content: { paddingHorizontal: 20 },
  searchField: { marginTop: 4 },
  fullBleedCarousel: { marginHorizontal: -20 },
  filters: { gap: 7, paddingTop: 13, paddingBottom: 3, paddingHorizontal: 20 },
  filterButton: { width: 90, borderRadius: 18, borderCurve: 'continuous' },
  filterButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  filterText: { color: '#A39BB4', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF', fontWeight: '700' },
  loader: { marginTop: 80 },
  results: { paddingTop: 7 },
  mixedResults: { gap: 7, paddingTop: 13 },
  section: { marginTop: 20, gap: 5 },
  sectionTitle: {
    marginBottom: 5,
    color: '#DCD6F7',
    fontSize: 23,
    fontWeight: '700',
  },
  result: { width: '100%', backgroundColor: 'transparent', borderWidth: 0 },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultImage: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#1F1D23',
  },
  resultCopy: { flex: 1 },
  resultTitle: { color: '#DCD6F7', fontSize: 16, fontWeight: '600' },
  resultSubtitle: { marginTop: 1, color: '#8A85A1', fontSize: 13 },
  categorySection: { marginTop: 24 },
  browseTitle: { marginBottom: 14 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: BROWSE_TILE_GAP },
  categoryCard: {
    height: BROWSE_TILE_HEIGHT,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 13,
    borderRadius: BROWSE_TILE_RADIUS,
  },
  eventsSection: { marginTop: 25 },
  eventCard: { width: '100%', height: 116, marginTop: 5 },
  categoryShade: { position: 'absolute', inset: 0 },
  categoryName: {
    maxWidth: '78%',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowRadius: 5,
  },
  categoryPressed: { opacity: 0.78 },
  categoryPressedScale: { transform: [{ scale: 0.98 }] },
  empty: {
    minHeight: 330,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyTitle: {
    marginTop: 18,
    color: '#DCD6F7',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 7,
    color: '#8A85A1',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
});
