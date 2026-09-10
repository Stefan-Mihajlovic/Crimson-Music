import { Image, ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useMainHeaderScroll } from '@/hooks/use-main-header-scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthFieldHandle } from '@/components/auth-field.types';
import GlassPressable from '@/components/glass-pressable';
import LiquidSearchField from '@/components/liquid-search-field';
import MainHeaderOverlay, { MainHeaderSpacer } from '@/components/main-header-overlay';
import MainNativeHeader from '@/components/main-native-header';
import MainScreenBackground from '@/components/main-screen-background';
import SongListRow from '@/components/song-list-row';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref, useDetailRoutes } from '@/services/action-sheet';
import {
  CrimsonCategory,
  CrimsonEvent,
  CrimsonPlaylist,
  CrimsonProfile,
  DiscoveryCatalog,
  loadDiscoveryCatalog,
} from '@/services/music';
import { subscribeToSearchFocus, subscribeToSearchQuery } from '@/services/navigation-events';

const defaultSongImage = require('@/assets/images/home/default-song.webp');
const defaultArtistImage = require('@/assets/images/home/default-artist.webp');
const profileImages: Record<string, ImageSource> = {
  '1': require('@/assets/images/home/profiles/1.png'),
  '2': require('@/assets/images/home/profiles/2.png'),
  '3': require('@/assets/images/home/profiles/3.png'),
  '4': require('@/assets/images/home/profiles/4.png'),
  '5': require('@/assets/images/home/profiles/5.png'),
  '6': require('@/assets/images/home/profiles/6.png'),
};

type SearchFilter = 'all' | 'songs' | 'artists' | 'playlists' | 'events' | 'profiles';
type MixedSearchResult =
  | { kind: 'artist'; item: DiscoveryCatalog['artists'][number]; score: number }
  | { kind: 'event'; item: DiscoveryCatalog['events'][number]; score: number }
  | { kind: 'playlist'; item: DiscoveryCatalog['playlists'][number]; score: number }
  | { kind: 'profile'; item: DiscoveryCatalog['profiles'][number]; score: number }
  | { kind: 'song'; item: DiscoveryCatalog['songs'][number]; score: number };
const filters: { id: SearchFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'songs', label: 'Songs' },
  { id: 'artists', label: 'Artists' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'events', label: 'Events' },
  { id: 'profiles', label: 'Profiles' },
];

const emptyCatalog: DiscoveryCatalog = {
  songs: [],
  artists: [],
  playlists: [],
  categories: [],
  profiles: [],
  events: [],
};

export default function SearchScreen() {
  const router = useRouter();
  const { artistHref, categoryHref, eventHref, playlistHref } = useDetailRoutes();
  const insets = useSafeAreaInsets();
  const headerScroll = useMainHeaderScroll();
  const { playSong } = usePlayer();
  const { colors } = useAppSettings();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [catalog, setCatalog] = useState<DiscoveryCatalog>(emptyCatalog);
  const [loading, setLoading] = useState(true);
  const searchFieldRef = useRef<AuthFieldHandle>(null);

  useEffect(() => {
    let active = true;
    const normalized = query.trim();
    const delay = normalized ? 350 : 0;
    const timer = setTimeout(() => {
      setLoading(true);
      loadDiscoveryCatalog(normalized)
        .then((nextCatalog) => { if (active) setCatalog(nextCatalog); })
        .catch(() => {
          if (active) Alert.alert('Search is unavailable', 'Check your connection and try again.');
        })
        .finally(() => { if (active) setLoading(false); });
    }, delay);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => subscribeToSearchFocus(() => searchFieldRef.current?.focus()), []);
  useEffect(() => subscribeToSearchQuery((nextQuery) => {
    setFilter('all');
    setQuery(nextQuery);
  }), []);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return emptyCatalog;
    return { ...catalog, categories: [] };
  }, [catalog, query]);

  const mixedResults = useMemo(
    () => rankSearchResults(results, query),
    [query, results],
  );

  const visibleCount = filter === 'all' ? mixedResults.length
    : filter === 'songs' ? results.songs.length
      : filter === 'artists' ? results.artists.length
        : filter === 'playlists' ? results.playlists.length
          : filter === 'events' ? results.events.length
            : results.profiles.length;

  const chooseCategory = (category: CrimsonCategory) => {
    router.push(categoryHref(category.id));
  };

  return (
    <MainScreenBackground>
      <MainNativeHeader offset={headerScroll.offset} title="Search" />
      <Reanimated.ScrollView
          alwaysBounceVertical
          bounces
          contentInsetAdjustmentBehavior="never"
          onScroll={headerScroll.onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 150 }]}>
          <MainHeaderSpacer />
          <View style={styles.searchField}>
            <LiquidSearchField
              ref={searchFieldRef}
              placeholder="Artists, Songs, Lyrics and More"
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <ScrollView
            horizontal
            alwaysBounceHorizontal
            bounces
            showsHorizontalScrollIndicator={false}
            style={styles.fullBleedCarousel}
            contentContainerStyle={styles.filters}>
            {filters.map((item) => (
              <GlassPressable
                key={item.id}
                accessibilityLabel={`Show ${item.label} results`}
                cornerRadius={18}
                height={36}
                onPress={() => setFilter(item.id)}
                tintColor={filter === item.id ? colors.accent : 'rgba(34,29,42,0.46)'}
                contentStyle={styles.filterButtonContent}
                style={[
                  styles.filterButton,
                  filter === item.id && { backgroundColor: colors.accent },
                ]}>
                <Text style={[styles.filterText, { color: filter === item.id ? '#FFFFFF' : colors.secondaryText }, filter === item.id && styles.filterTextActive]}>{item.label}</Text>
              </GlassPressable>
            ))}
          </ScrollView>

          {loading ? (
            <ActivityIndicator color="#A97AFF" size="large" style={styles.loader} />
          ) : !query.trim() ? (
            <CategoryGrid categories={catalog.categories} onChoose={chooseCategory} />
          ) : visibleCount === 0 ? (
            <EmptySearch title="No results yet" body={`Nothing matched “${query.trim()}”.`} />
          ) : (
            <View style={styles.results}>
              {filter === 'all' ? (
                <View style={styles.mixedResults}>
                  {mixedResults.map((result) => {
                    if (result.kind === 'song') {
                      const song = result.item;
                      return (
                        <SongListRow
                          key={`song-${song.id}`}
                          song={song}
                          onPress={() => playSong(song, results.songs, 'Search')}
                          onMenuPress={() => router.push(actionSheetHref({ type: 'song', id: song.id, title: song.title, subtitle: song.creator, image: song.imageSmall || song.image, artistId: song.artistId, source: song.source }))}
                        />
                      );
                    }
                    if (result.kind === 'artist') {
                      const artist = result.item;
                      return (
                        <SearchRow
                          key={`artist-${artist.id}`}
                          fallback={defaultArtistImage}
                          icon="person.crop.circle"
                          image={artist.imageSmall}
                          onLongPress={() => router.push(actionSheetHref({ type: 'artist', id: artist.id, title: artist.name, subtitle: `${artist.followers} followers`, image: artist.imageSmall || artist.image }))}
                          onPress={() => router.push(artistHref(artist.id))}
                          subtitle="Artist"
                          title={artist.name}
                        />
                      );
                    }
                    if (result.kind === 'playlist') {
                      const playlist = result.item;
                      return <PlaylistResult key={`playlist-${playlist.id}`} playlist={playlist} onPress={() => router.push(playlistHref(playlist.id, false, playlist.source, playlist.title))} onLongPress={() => router.push(actionSheetHref({ type: 'playlist', id: playlist.id, title: playlist.title, subtitle: playlist.artists, image: playlist.imageSmall || playlist.image, coverImages: playlist.coverImages, source: playlist.source }))} />;
                    }
                    if (result.kind === 'event') {
                      const event = result.item;
                      return <EventResult key={`event-${event.id}`} event={event} onPress={() => router.push(eventHref(event.id))} />;
                    }
                    return <ProfileResult key={`profile-${result.item.id}`} profile={result.item} />;
                  })}
                </View>
              ) : null}
              {filter === 'artists' && results.artists.length ? (
                <ResultSection title="Artists">
                  {results.artists.map((artist) => (
                    <SearchRow
                      key={`artist-${artist.id}`}
                      image={artist.imageSmall}
                      fallback={defaultArtistImage}
                      title={artist.name}
                      subtitle="Artist"
                      icon="person.crop.circle"
                      onPress={() => router.push(artistHref(artist.id))}
                      onLongPress={() => router.push(actionSheetHref({ type: 'artist', id: artist.id, title: artist.name, subtitle: `${artist.followers} followers`, image: artist.imageSmall || artist.image }))}
                    />
                  ))}
                </ResultSection>
              ) : null}
              {filter === 'songs' && results.songs.length ? (
                <ResultSection title="Songs">
                  {results.songs.map((song) => (
                    <SongListRow
                      key={`song-${song.id}`}
                      song={song}
                      onPress={() => playSong(song, results.songs, 'Search')}
                      onMenuPress={() => router.push(actionSheetHref({ type: 'song', id: song.id, title: song.title, subtitle: song.creator, image: song.imageSmall || song.image, artistId: song.artistId, source: song.source }))}
                    />
                  ))}
                </ResultSection>
              ) : null}
              {filter === 'playlists' && results.playlists.length ? (
                <ResultSection title="Playlists">
                  {results.playlists.map((playlist) => <PlaylistResult key={`playlist-${playlist.id}`} playlist={playlist} onPress={() => router.push(playlistHref(playlist.id, false, playlist.source, playlist.title))} onLongPress={() => router.push(actionSheetHref({ type: 'playlist', id: playlist.id, title: playlist.title, subtitle: playlist.artists, image: playlist.imageSmall || playlist.image, coverImages: playlist.coverImages, source: playlist.source }))} />)}
                </ResultSection>
              ) : null}
              {filter === 'events' && results.events.length ? (
                <ResultSection title="Events">
                  {results.events.map((event) => <EventResult key={`event-${event.id}`} event={event} onPress={() => router.push(eventHref(event.id))} />)}
                </ResultSection>
              ) : null}
              {filter === 'profiles' && results.profiles.length ? (
                <ResultSection title="Profiles">
                  {results.profiles.map((profile) => <ProfileResult key={`profile-${profile.id}`} profile={profile} />)}
                </ResultSection>
              ) : null}
            </View>
          )}
      </Reanimated.ScrollView>
      <MainHeaderOverlay title="Search" offset={headerScroll.offset} />
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

function searchRelevance(query: string, primary: string, secondary = '', sourceIndex = 0) {
  const normalizedQuery = normalizeSearchValue(query);
  const normalizedPrimary = normalizeSearchValue(primary);
  const normalizedSecondary = normalizeSearchValue(secondary);
  if (!normalizedQuery) return 0;

  let score = 0;
  if (normalizedPrimary === normalizedQuery) score = 1_000;
  else if (normalizedPrimary.startsWith(normalizedQuery)) score = 820;
  else if (normalizedPrimary.split(/\s+/).some((word) => word.startsWith(normalizedQuery))) score = 700;
  else if (normalizedPrimary.includes(normalizedQuery)) score = 590;

  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);
  const primaryWords = normalizedPrimary.split(/\s+/).filter(Boolean);
  const matchingWords = queryWords.filter((word) => primaryWords.some((candidate) => candidate.startsWith(word))).length;
  score += matchingWords * 70;

  if (normalizedSecondary === normalizedQuery) score += 390;
  else if (normalizedSecondary.startsWith(normalizedQuery)) score += 310;
  else if (normalizedSecondary.includes(normalizedQuery)) score += 220;

  // Preserve the provider's relevance ordering without letting one result
  // type monopolize the top of the combined list.
  return score - sourceIndex * 7;
}

function rankSearchResults(results: DiscoveryCatalog, query: string): MixedSearchResult[] {
  const ranked: MixedSearchResult[] = [
    ...results.songs.map((item, index) => ({ kind: 'song' as const, item, score: searchRelevance(query, item.title, item.creator, index) })),
    ...results.artists.map((item, index) => ({ kind: 'artist' as const, item, score: searchRelevance(query, item.name, item.handle, index) })),
    ...results.playlists.map((item, index) => ({ kind: 'playlist' as const, item, score: searchRelevance(query, item.title, item.artists, index) })),
    ...results.events.map((item, index) => ({ kind: 'event' as const, item, score: searchRelevance(query, item.title, item.hostName, index) })),
    ...results.profiles.map((item, index) => ({ kind: 'profile' as const, item, score: searchRelevance(query, item.username, 'Crimson profile', index) })),
  ];
  return ranked.sort((left, right) => right.score - left.score);
}

function CategoryGrid({ categories, onChoose }: { categories: CrimsonCategory[]; onChoose: (category: CrimsonCategory) => void }) {
  const { colors, reduceMotion } = useAppSettings();
  const eventCategory = categories.find((category) => category.id === 'events');
  const browseCategories = categories.filter((category) => category.id !== 'events');
  return (
    <View style={styles.categorySection}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Browse categories</Text>
      <View style={styles.categoryGrid}>
        {browseCategories.map((category) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={`Browse ${category.name}`}
            onPress={() => onChoose(category)}
            style={({ pressed }) => [styles.categoryCard, { backgroundColor: category.color }, pressed && styles.categoryPressed, pressed && !reduceMotion && styles.categoryPressedScale]}>
            {category.localImage || category.imageSmall ? <Image source={category.localImage || { uri: category.imageSmall }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
            <LinearGradient colors={[`${category.color}18`, `${category.color}E8`]} locations={[0.05, 1]} style={styles.categoryShade} />
            <Text numberOfLines={2} style={styles.categoryName}>{category.name}</Text>
            <SymbolView name="arrow.up.right" size={16} tintColor="#FFFFFF" weight="bold" />
          </Pressable>
        ))}
      </View>
      {eventCategory ? (
        <View style={styles.eventsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Events</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Browse Events"
            onPress={() => onChoose(eventCategory)}
            style={({ pressed }) => [styles.categoryCard, styles.eventCard, { backgroundColor: eventCategory.color }, pressed && styles.categoryPressed, pressed && !reduceMotion && styles.categoryPressedScale]}>
            {eventCategory.localImage || eventCategory.imageSmall ? <Image source={eventCategory.localImage || { uri: eventCategory.imageSmall }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
            <LinearGradient colors={[`${eventCategory.color}12`, `${eventCategory.color}E8`]} locations={[0.05, 1]} style={styles.categoryShade} />
            <Text style={styles.categoryName}>Events</Text>
            <SymbolView name="arrow.up.right" size={18} tintColor="#FFFFFF" weight="bold" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ResultSection({ children, title }: { children: React.ReactNode; title: string }) {
  const { colors } = useAppSettings();
  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>{children}</View>;
}

function PlaylistResult({ onLongPress, onPress, playlist }: { onLongPress: () => void; onPress: () => void; playlist: CrimsonPlaylist }) {
  return <SearchRow image={playlist.imageSmall} fallback={defaultSongImage} title={playlist.title} subtitle={playlist.artists} icon="music.note.list" onPress={onPress} onLongPress={onLongPress} />;
}

function EventResult({ event, onPress }: { event: CrimsonEvent; onPress: () => void }) {
  const deadline = event.endDate
    ? `Ends ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(event.endDate))}`
    : 'Audius event';
  return <SearchRow image={event.image || event.hostImage} fallback={defaultSongImage} title={event.title} subtitle={`${event.hostName} · ${deadline}`} icon="calendar" onPress={onPress} />;
}

function ProfileResult({ profile }: { profile: CrimsonProfile }) {
  const fallback = profileImages[profile.image] || profileImages['1'];
  return <SearchRow image={/^https?:\/\//.test(profile.image) ? profile.image : ''} fallback={fallback} title={profile.username} subtitle="Crimson profile" icon="person.fill" onPress={() => Alert.alert(profile.username, 'Crimson profile')} />;
}

function SearchRow({ fallback, icon, image, onLongPress, onPress, subtitle, title }: { fallback: ImageSource; icon: 'person.crop.circle' | 'play.fill' | 'music.note.list' | 'person.fill' | 'calendar'; image: string; onLongPress?: () => void; onPress: () => void; subtitle: string; title: string }) {
  const { colors } = useAppSettings();
  return (
    <GlassPressable
      accessibilityLabel={`${title}, ${subtitle}`}
      cornerRadius={16}
      height={56}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.result}
      contentStyle={styles.resultContent}>
      <Image contentFit="cover" source={image ? { uri: image } : fallback} style={styles.resultImage} />
      <View style={styles.resultCopy}>
        <Text numberOfLines={1} style={[styles.resultTitle, { color: colors.text }]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.resultSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text>
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
      <Text style={[styles.emptyBody, { color: colors.secondaryText }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E0D13' },
  content: { paddingHorizontal: 20 },
  searchField: { marginTop: 4 },
  fullBleedCarousel: { marginHorizontal: -20 },
  filters: { gap: 7, paddingTop: 13, paddingBottom: 3, paddingHorizontal: 20 },
  filterButton: { width: 90, borderRadius: 18, borderCurve: 'continuous' },
  filterButtonContent: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  filterText: { color: '#A39BB4', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF', fontWeight: '700' },
  loader: { marginTop: 80 },
  results: { paddingTop: 7 },
  mixedResults: { gap: 7, paddingTop: 13 },
  section: { marginTop: 20, gap: 5 },
  sectionTitle: { marginBottom: 5, color: '#DCD6F7', fontSize: 23, fontWeight: '700' },
  result: { width: '100%', backgroundColor: 'transparent', borderWidth: 0 },
  resultContent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8, paddingRight: 18 },
  resultImage: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#1F1D23' },
  resultCopy: { flex: 1 },
  resultTitle: { color: '#DCD6F7', fontSize: 16, fontWeight: '600' },
  resultSubtitle: { marginTop: 1, color: '#8A85A1', fontSize: 13 },
  categorySection: { marginTop: 24 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '48.5%', height: 96, overflow: 'hidden', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: 13, borderRadius: 18 },
  eventsSection: { marginTop: 25 },
  eventCard: { width: '100%', height: 116, marginTop: 5 },
  categoryShade: { position: 'absolute', inset: 0 },
  categoryName: { maxWidth: '78%', color: '#FFFFFF', fontSize: 18, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 5 },
  categoryPressed: { opacity: 0.78 },
  categoryPressedScale: { transform: [{ scale: 0.98 }] },
  empty: { minHeight: 330, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { marginTop: 18, color: '#DCD6F7', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  emptyBody: { marginTop: 7, color: '#8A85A1', fontSize: 15, lineHeight: 21, textAlign: 'center' },
});
