import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView, SymbolViewProps } from '@/components/app-symbol';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Alert } from '@/services/alert';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { profileImageSource } from '@/components/profile-images';
import { useAuth } from '@/providers/auth-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { loadMonthlyListeningStats, ProfileListeningStats, subscribeLocalListeningHistory } from '@/services/music';
import { usePlayer } from '@/providers/player-provider';
import { getAudiusTrack } from '@/services/audius';
import { getCurrentAudiusUserId } from '@/services/audius-session';
import { useDetailRoutes } from '@/services/action-sheet';

type StatSlide = {
  accent: string;
  artworks: { image: string; imageSmall: string }[];
  artworkShape?: 'artists' | 'top-artist';
  calendar?: {
    days: number;
    listenedDays: number[];
  };
  colors: [string, string, string];
  icon: SymbolViewProps['name'];
  id: string;
  title: string;
  value: string;
};

const emptyStats: ProfileListeningStats = {
  artists: 0,
  listeningDays: 0,
  longestStreak: 0,
  minutes: 0,
  plays: 0,
  topArtist: '',
  topArtistPlays: 0,
  topTracks: [],
  uniqueTracks: 0,
};

export default function ProfileSettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { artistHref } = useDetailRoutes();
  const { playSong } = usePlayer();
  const { colors, performanceMode, reduceMotion } = useAppSettings();
  const { width: screenWidth } = useWindowDimensions();
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [stats, setStats] = useState<ProfileListeningStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [recapBusy, setRecapBusy] = useState(false);
  const recapPending = useRef(false);
  const requestRevision = useRef(0);
  const recapCache = useRef(new Map<string, ProfileListeningStats>());
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const uid = user?.uid;
  const savedPhoto = user?.ProfilePhoto || '1';
  const monthName = selectedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedMonthKey = keyForMonth(selectedMonth);
  const deckWidth = Math.min(screenWidth - 80, 360);

  const loadStats = useCallback((force = false) => {
    const revision = ++requestRevision.current;
    const cached = recapCache.current.get(`${uid}:${keyForMonth(selectedMonth)}`);
    setStats(cached || null);
    setStatsError(null);
    setStatsLoading(!cached);
    setRefreshing(force && !!cached);
    if (!uid) { setStatsLoading(false); setRefreshing(false); return; }
    void loadMonthlyListeningStats(uid, { force, month: selectedMonth }).then((nextStats) => {
      if (revision !== requestRevision.current) return;
      recapCache.current.set(`${uid}:${keyForMonth(selectedMonth)}`, nextStats);
      setStats(nextStats);
    }).catch(() => {
      if (revision === requestRevision.current) setStatsError(cached ? 'Could not refresh this recap. Showing the last saved result.' : 'Could not load this recap. Your listening data has not been cleared.');
    }).finally(() => {
      if (revision === requestRevision.current) { setStatsLoading(false); setRefreshing(false); }
    });
  }, [selectedMonth, uid]);
  useFocusEffect(useCallback(() => {
    loadStats();
    const unsubscribe = uid ? subscribeLocalListeningHistory(uid, () => { recapCache.current.clear(); loadStats(true); }) : undefined;
    return () => { requestRevision.current += 1; unsubscribe?.(); };
  }, [loadStats, uid]));
  const refreshStats = () => loadStats(true);
  const playRecap = async (trackId?: string) => {
    if (!uid || !stats?.topTracks?.length || recapPending.current) return;
    recapPending.current = true; setRecapBusy(true);
    const revision = requestRevision.current;
    try {
      const songs = (await Promise.all(stats.topTracks.map((track) => getAudiusTrack(track.id).catch(() => null)))).filter((song): song is NonNullable<typeof song> => !!song && song.streamable);
      if (revision !== requestRevision.current || uid !== getCurrentAudiusUserId()) return;
      const first = trackId ? songs.find((song) => song.id === trackId) : songs[0];
      if (!first) throw new Error('This recap track is currently unavailable.');
      await playSong(first, songs, `${monthName} recap`);
    } catch { if (revision === requestRevision.current) setStatsError('Could not play this recap. Try another track or check your connection.'); }
    finally { recapPending.current = false; setRecapBusy(false); }
  };

  const selectMonth = (month: Date) => {
    if (keyForMonth(month) === selectedMonthKey) return;
    setStatsLoading(true);
    setSelectedMonth(month);
  };

  const slides = createSlides(stats || emptyStats, selectedMonth);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Profile' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            onRefresh={() => void refreshStats()}
            refreshing={refreshing}
            tintColor={colors.accent}
          />
        )}
        showsVerticalScrollIndicator={false}>
        <SectionLabel title="YOUR AUDIUS PROFILE" />
        <View style={[styles.profileCard, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
          <Image
            contentFit="cover"
            source={profileImageSource(savedPhoto)}
            style={[styles.avatar, { borderColor: colors.accent }]}
          />
          <View style={styles.profileCopy}>
            <Text numberOfLines={1} style={[styles.profileName, { color: colors.text }]}>
              {user?.DisplayName || user?.Username}
            </Text>
            <Text numberOfLines={1} style={[styles.profileEmail, { color: colors.secondaryText }]}>
              @{user?.Username} · Audius
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Open your profile on Audius"
            accessibilityRole="button"
            onPress={() => void Linking.openURL(`https://audius.co/${encodeURIComponent(user?.Username || '')}`).catch(() => Alert.alert('Could not open Audius', 'Please try again.'))}
            style={({ pressed }) => [
              styles.editButton,
              { backgroundColor: colors.accent },
              pressed && styles.pressed,
            ]}>
            <SymbolView name="arrow.up.right" size={14} tintColor="#FFFFFF" weight="semibold" />
            <Text style={[styles.editButtonText, { color: '#FFFFFF' }]}>Audius</Text>
          </Pressable>
        </View>

        <SectionLabel title="LISTENING ON THIS DEVICE" />
        <MonthSelector selectedMonth={selectedMonth} onSelect={selectMonth} />
        {statsError && <View style={[styles.feedback, { backgroundColor: colors.accentSoft }]}><Text accessibilityRole="alert" style={{ color: colors.text }}>{statsError}</Text><Pressable accessibilityRole="button" onPress={refreshStats} style={styles.recapAction}><Text style={{ color: colors.accent }}>Try again</Text></Pressable></View>}
        {statsLoading ? <LoadingDeck deckWidth={deckWidth} monthName={monthName} /> : stats && (stats.plays > 0 || stats.minutes > 0) ? <>
          <StatsDeck key={`${selectedMonthKey}:${deckWidth}`} viewportWidth={screenWidth} deckWidth={deckWidth} monthKey={selectedMonthKey} monthName={monthName} reduceMotion={performanceMode || reduceMotion} slides={slides} />
          <Text style={[styles.recapNote, { color: colors.secondaryText }]}>Based on listening records retained on this device. Older months may be incomplete if local history was cleared.</Text>
          {!!stats.topTracks?.length && <SectionLabel title="YOUR TOP TRACKS" />}
          {stats.topTracks?.map((track, index) => <Pressable key={track.id} accessibilityRole="button" accessibilityLabel={`Play ${track.title} by ${track.creator}`} disabled={recapBusy} onPress={() => void playRecap(track.id)} style={styles.topRow}>
            <Text style={{ color: colors.mutedText, width: 20 }}>{index + 1}</Text>
            <Image source={{ uri: track.imageSmall || track.image }} contentFit="cover" style={styles.topArtwork} />
            <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600' }}>{track.title}</Text><Text numberOfLines={1} style={{ color: colors.secondaryText, marginTop: 3 }}>{track.creator} · {track.plays} plays</Text></View>
            <SymbolView name="play.fill" size={16} tintColor={colors.text} />
          </Pressable>)}
          {!!stats.topArtists?.length && <SectionLabel title="YOUR TOP ARTISTS" />}
          {stats.topArtists?.map((artist) => <Pressable key={artist.id || artist.name} accessibilityRole="button" accessibilityLabel={`Open ${artist.name}`} disabled={!artist.id} onPress={() => router.push(artistHref(artist.id))} style={styles.topRow}>
            <Image source={profileImageSource(artist.imageSmall || artist.image || '1')} contentFit="cover" style={[styles.topArtwork, { borderRadius: 24 }]} />
            <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '600' }}>{artist.name}</Text><Text style={{ color: colors.secondaryText, marginTop: 3 }}>{artist.plays} plays</Text></View><SymbolView name="chevron.right" size={14} tintColor={colors.secondaryText} />
          </Pressable>)}
        </> : stats ? <View style={[styles.feedback, { backgroundColor: colors.controlSurface }]}><Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>No listening saved for this month</Text><Text style={[styles.recapNote, { color: colors.secondaryText }]}>Play some music to build your next recap. Only listening recorded on this device appears here.</Text></View> : null}


      </ScrollView>
    </View>
  );
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function keyForMonth(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function MonthSelector({ onSelect, selectedMonth }: { onSelect: (month: Date) => void; selectedMonth: Date }) {
  const { colors, reduceMotion } = useAppSettings();
  const selectedKey = keyForMonth(selectedMonth);
  const months = useMemo(() => {
    const current = startOfMonth(new Date());
    return Array.from({ length: 12 }, (_, index) => (
      new Date(current.getFullYear(), current.getMonth() - index, 1)
    ));
  }, []);

  return (
    <View style={styles.monthSelector}>
      <View style={styles.monthSelectorHeader}>
        <Text style={[styles.monthSelectorTitle, { color: colors.text }]}>Recap archive</Text>
        <Text style={[styles.monthSelectorCaption, { color: colors.secondaryText }]}>On this device</Text>
      </View>
      <ScrollView
        horizontal
        bounces
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -16 }}
        contentContainerStyle={styles.monthList}>
        {months.map((month, index) => {
          const key = keyForMonth(month);
          const selected = key === selectedKey;
          return (
            <Pressable
              key={key}
              accessibilityLabel={`Show recap for ${month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(month)}
              style={({ pressed }) => [
                styles.monthChip,
                {
                  backgroundColor: selected ? colors.accent : colors.controlSurface,
                  borderColor: selected ? colors.accent : colors.border,
                },
                pressed && styles.pressed,
                pressed && !reduceMotion && styles.monthChipPressed,
              ]}>
              <Text style={[styles.monthChipMonth, { color: selected ? '#FFFFFF' : colors.text }]}>
                {index === 0 ? 'Now' : month.toLocaleDateString(undefined, { month: 'short' })}
              </Text>
              <Text style={[styles.monthChipYear, { color: selected ? 'rgba(255,255,255,0.72)' : colors.mutedText }]}>
                {month.getFullYear()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function StatsDeck({
  viewportWidth,
  deckWidth,
  monthKey,
  monthName,
  reduceMotion,
  slides,
}: {
  viewportWidth: number;
  deckWidth: number;
  monthKey: string;
  monthName: string;
  reduceMotion: boolean;
  slides: StatSlide[];
}) {
  const pageWidth = deckWidth + 12;
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  return (
    <Animated.View key={monthKey} entering={reduceMotion ? undefined : FadeIn.duration(260)} style={styles.deckEntrance}>
      <View style={{ width: viewportWidth, height: 350 }}>
        <Animated.ScrollView
          bounces={false}
          decelerationRate="fast"
          horizontal
          onScroll={onScroll}
          snapToInterval={pageWidth}
          disableIntervalMomentum
          contentContainerStyle={{ paddingHorizontal: (viewportWidth - deckWidth) / 2, gap: 12 }}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator={false}>
          {slides.map((slide, index) => (
            <SwipeStatCard
              key={slide.id}
              cardWidth={deckWidth}
              index={index}
              monthName={monthName}
              pageWidth={pageWidth}
              reduceMotion={reduceMotion}
              scrollX={scrollX}
              slide={slide}
            />
          ))}
        </Animated.ScrollView>
        <View pointerEvents="none" style={styles.pagination}>
          {slides.map((slide, index) => (
            <PaginationDot key={slide.id} index={index} pageWidth={pageWidth} scrollX={scrollX} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

function PaginationDot({ index, pageWidth, scrollX }: { index: number; pageWidth: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [(index - 1) * pageWidth, index * pageWidth, (index + 1) * pageWidth],
      [0.3, 1, 0.3],
      Extrapolation.CLAMP,
    ),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

function SwipeStatCard({
  cardWidth,
  index,
  monthName,
  pageWidth,
  reduceMotion,
  scrollX,
  slide,
}: {
  index: number;
  monthName: string;
  pageWidth: number;
  cardWidth: number;
  reduceMotion: boolean;
  scrollX: SharedValue<number>;
  slide: StatSlide;
}) {
  const { dataSaver, performanceMode } = useAppSettings();
  const contentAnimatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    const inputRange = [
      (index - 1) * pageWidth,
      index * pageWidth,
      (index + 1) * pageWidth,
    ];
    return {
      opacity: interpolate(scrollX.value, inputRange, [0.34, 1, 0.34], Extrapolation.CLAMP),
      transform: [
        {
          translateX: interpolate(
            scrollX.value,
            inputRange,
            [46, 0, -46],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });
  const artworkAnimatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ scale: 1.06 }] };
    const inputRange = [
      (index - 1) * pageWidth,
      index * pageWidth,
      (index + 1) * pageWidth,
    ];
    return {
      transform: [
        { translateX: interpolate(scrollX.value, inputRange, [-28, 0, 28], Extrapolation.CLAMP) },
        { scale: 1.06 },
      ],
    };
  });
  const leftArtworkAnimatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0.76 };
    const progress = Math.min(1, Math.abs(scrollX.value - index * pageWidth) / pageWidth);
    return {
      opacity: interpolate(progress, [0, 1], [0.76, 0.46], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(progress, [0, 1], [0, 42], Extrapolation.CLAMP) },
        { translateY: interpolate(progress, [0, 1], [0, 4], Extrapolation.CLAMP) },
      ],
    };
  });
  const rightArtworkAnimatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0.76 };
    const progress = Math.min(1, Math.abs(scrollX.value - index * pageWidth) / pageWidth);
    return {
      opacity: interpolate(progress, [0, 1], [0.76, 0.46], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(progress, [0, 1], [0, -42], Extrapolation.CLAMP) },
        { translateY: interpolate(progress, [0, 1], [0, 4], Extrapolation.CLAMP) },
      ],
    };
  });
  const primaryArtworkAnimatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    const progress = Math.min(1, Math.abs(scrollX.value - index * pageWidth) / pageWidth);
    return {
      transform: [{ scale: interpolate(progress, [0, 1], [1, 1.025], Extrapolation.CLAMP) }],
    };
  });
  const artworkSources = slide.artworks
    .map((artwork) => dataSaver ? artwork.imageSmall || artwork.image : artwork.image || artwork.imageSmall)
    .filter(Boolean);
  const primaryArtwork = artworkSources[0];
  const circularPrimaryArtwork = slide.artworkShape === 'artists' || slide.artworkShape === 'top-artist';
  const circularSideArtwork = slide.artworkShape === 'artists';

  return (
    <View
      accessibilityLabel={`${slide.title}: ${slide.value}`}
      style={[styles.recapSlider, styles.recapPage, { width: cardWidth }]}>
      <LinearGradient
        colors={slide.colors}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {primaryArtwork && !performanceMode && !dataSaver ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.recapBackdrop, artworkAnimatedStyle]}>
          <Image
            blurRadius={24}
            contentFit="cover"
            source={{ uri: primaryArtwork }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      <LinearGradient
        colors={['rgba(7,5,11,0.28)', 'rgba(8,6,12,0.52)', 'rgba(8,6,12,0.98)']}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      {slide.calendar ? (
        <Animated.View pointerEvents="none" style={[styles.recapCalendarStage, artworkAnimatedStyle]}>
          {Array.from({ length: slide.calendar.days }, (_, dayIndex) => {
            const day = dayIndex + 1;
            const listened = slide.calendar?.listenedDays.includes(day);
            return (
              <View
                key={day}
                style={[styles.recapCalendarDay, listened && styles.recapCalendarDayListened]}>
                {listened ? (
                  <SymbolView name="flame.fill" size={16} tintColor="#B56EFF" weight="semibold" />
                ) : (
                  <View style={styles.recapCalendarDot} />
                )}
              </View>
            );
          })}
        </Animated.View>
      ) : artworkSources.length ? (
        <Animated.View pointerEvents="none" style={[styles.recapArtworkStage, artworkAnimatedStyle]}>
          {artworkSources[1] ? (
            <Animated.View style={[
              styles.recapSideArtwork,
              circularSideArtwork && styles.recapCircularSideArtwork,
              styles.recapSideArtworkLeft,
              leftArtworkAnimatedStyle,
            ]}>
              <Image contentFit="cover" source={{ uri: artworkSources[1] }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          ) : null}
          {artworkSources[2] ? (
            <Animated.View style={[
              styles.recapSideArtwork,
              circularSideArtwork && styles.recapCircularSideArtwork,
              styles.recapSideArtworkRight,
              rightArtworkAnimatedStyle,
            ]}>
              <Image contentFit="cover" source={{ uri: artworkSources[2] }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          ) : null}
          <Animated.View style={[
            styles.recapPrimaryArtwork,
            circularPrimaryArtwork && styles.recapCircularPrimaryArtwork,
            primaryArtworkAnimatedStyle,
          ]}>
            <Image contentFit="cover" source={{ uri: primaryArtwork }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.recapContent, contentAnimatedStyle]}>
        <Text style={styles.recapMonth}>{monthName.toUpperCase()}</Text>
        <View style={styles.recapMetric}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            numberOfLines={1}
            style={styles.cardValue}>
            {slide.value}
          </Text>
          <View style={styles.recapTitleRow}>
            <SymbolView name={slide.icon} size={15} tintColor={slide.accent} weight="semibold" />
            <Text style={styles.cardTitle}>{slide.title}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function LoadingDeck({ deckWidth, monthName }: { deckWidth: number; monthName: string }) {
  return (
    <LinearGradient
      colors={['#1A1420', '#100D15', '#0D0B11']}
      end={{ x: 1, y: 1 }}
      start={{ x: 0, y: 0 }}
      style={[styles.loadingDeck, { width: deckWidth }]}>
      <ActivityIndicator color="#B981FF" />
      <Text style={styles.loadingTitle}>Loading {monthName}</Text>
    </LinearGradient>
  );
}

function SectionLabel({ title }: { title: string }) {
  const { colors } = useAppSettings();
  return <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>{title}</Text>;
}

function createSlides(stats: ProfileListeningStats, month: Date): StatSlide[] {
  const artworks = stats.topTracks || [];
  const artists = stats.topArtists || [];
  const topArtist = artists[0];
  const artworksFor = (index: number) => artworks.length
    ? Array.from({ length: Math.min(3, artworks.length) }, (_, offset) => artworks[(index + offset) % artworks.length])
    : [];
  return [
    {
      accent: '#A66BFF',
      artworks: artworksFor(0),
      colors: ['#241735', '#17101F', '#100D15'],
      icon: 'play.fill',
      id: 'plays',
      title: 'Plays',
      value: formatStat(stats.plays),
    },
    {
      accent: '#E86BAE',
      artworks: artworksFor(1),
      colors: ['#2A1724', '#191016', '#100D13'],
      icon: 'clock.fill',
      id: 'minutes',
      title: 'Minutes listened',
      value: formatStat(stats.minutes),
    },
    {
      accent: '#758EFF',
      artworks: artworksFor(2),
      colors: ['#171C32', '#111522', '#0D0F16'],
      icon: 'music.note.list',
      id: 'tracks',
      title: 'Unique songs',
      value: formatStat(stats.uniqueTracks),
    },
    {
      accent: '#4CC5BB',
      artworks: artists.slice(0, 3),
      artworkShape: 'artists',
      colors: ['#142725', '#101B1A', '#0D1212'],
      icon: 'person.2.fill',
      id: 'artists',
      title: 'Artists',
      value: formatStat(stats.artists),
    },
    {
      accent: '#E8A956',
      artworks: topArtist ? [topArtist, ...topArtist.songs.slice(0, 2)] : artworksFor(4),
      artworkShape: topArtist ? 'top-artist' : undefined,
      colors: ['#2A2116', '#1A1610', '#110F0C'],
      icon: 'trophy.fill',
      id: 'top-artist',
      title: 'Top artist',
      value: stats.topArtist || 'Keep listening',
    },
    {
      accent: '#EE7184',
      artworks: [],
      calendar: {
        days: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
        listenedDays: stats.listeningDaysOfMonth || [],
      },
      colors: ['#2B171D', '#1A1114', '#110D0F'],
      icon: 'flame.fill',
      id: 'streak',
      title: 'Best streak',
      value: `${stats.longestStreak} ${stats.longestStreak === 1 ? 'day' : 'days'}`,
    },
  ];
}

function formatStat(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(value);
}

const styles = StyleSheet.create({
  feedback: { borderRadius: 20, padding: 18, marginBottom: 14 },
  recapAction: { minHeight: 48, paddingHorizontal: 18, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center' },
  recapNote: { fontSize: 13, lineHeight: 19, marginTop: 12, marginHorizontal: 4 },
  topRow: { minHeight: 70, flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  topArtwork: { width: 48, height: 48, borderRadius: 10 },
  screen: { flex: 1, backgroundColor: '#0E0D13' },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 180 },
  sectionLabel: {
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 14,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.35,
  },
  monthSelector: { marginBottom: 12 },
  monthSelectorHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 14, marginBottom: 8 },
  monthSelectorTitle: { fontSize: 15, fontWeight: '700' },
  monthSelectorCaption: { fontSize: 10, fontWeight: '600' },
  monthList: { gap: 7, paddingHorizontal: 20 },
  monthChip: {
    minWidth: 64,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  monthChipPressed: { transform: [{ scale: 0.97 }] },
  monthChipMonth: { fontSize: 13, fontWeight: '800' },
  monthChipYear: { marginTop: 1, fontSize: 9, fontWeight: '600' },
  profileCard: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    backgroundColor: '#29232F',
  },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 21, fontWeight: '700' },
  profileEmail: { marginTop: 4, fontSize: 13 },
  editButton: {
    minWidth: 66,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  editButtonText: { fontSize: 13, fontWeight: '700' },
  deckEntrance: { alignSelf: 'center' },
  recapSlider: {
    height: 350,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#17131D',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  recapPage: {
    height: 350,
    overflow: 'hidden',
  },
  recapBackdrop: { opacity: 0.42 },
  recapArtworkStage: { position: 'absolute', top: 46, left: 0, right: 0, height: 172, alignItems: 'center' },
  recapPrimaryArtwork: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -80,
    width: 160,
    height: 160,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.36)',
    backgroundColor: '#211C28',
    shadowColor: '#000000',
    shadowOpacity: 0.48,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  recapSideArtwork: {
    position: 'absolute',
    top: 20,
    width: 120,
    height: 120,
    overflow: 'hidden',
    opacity: 0.72,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.20)',
    backgroundColor: '#211C28',
  },
  recapCircularPrimaryArtwork: { borderRadius: 80 },
  recapCircularSideArtwork: { borderRadius: 60 },
  recapCalendarStage: {
    position: 'absolute',
    top: 40,
    left: '50%',
    width: 220,
    height: 168,
    marginLeft: -110,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  recapCalendarDay: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  recapCalendarDayListened: {
    backgroundColor: 'rgba(166,107,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(193,132,255,0.52)',
    shadowColor: '#A66BFF',
    shadowOpacity: 0.48,
    shadowRadius: 7,
  },
  recapCalendarDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  recapSideArtworkLeft: { left: 28 },
  recapSideArtworkRight: { right: 28 },
  recapContent: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 40 },
  recapMonth: { width: '100%', color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '800', letterSpacing: 1.35, textAlign: 'center' },
  recapMetric: { width: '100%', alignItems: 'center' },
  cardValue: {
    maxWidth: '90%',
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2.4,
    lineHeight: 60,
    textAlign: 'center',
  },
  recapTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
  cardTitle: { color: '#F4EEFF', fontSize: 18, fontWeight: '700' },
  pagination: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dot: { width: 18, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF' },
  loadingDeck: {
    minHeight: 350,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 24,
  },
  loadingTitle: { marginTop: 14, color: 'rgba(255,255,255,0.54)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  pressed: { opacity: 0.74 },
});
