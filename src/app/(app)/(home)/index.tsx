import { BrandAccent, brandAccentTint } from '@/constants/brand-accent';
import { FrostedLayer } from '@/components/frosted-surface';
import HomeQuickAccess from '@/components/home-quick-access';
import HomeDiscovery from '@/components/home-discovery';
import {
  preferredGenres,
  type DiscoveryProfile,
} from '@/services/discovery-profile';
import { useNetwork } from '@/providers/network-provider';
import { Image } from 'expo-image';
import ArtworkImage from '@/components/artwork-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from '@/components/app-symbol';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  Platform,
  useWindowDimensions,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Alert } from '@/services/alert';
import Reanimated from 'react-native-reanimated';
import { useMainHeaderScroll } from '@/hooks/use-main-header-scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import VaultGlassButton from '@/components/vault-glass-button';
import MainHeaderOverlay, {
  MainHeaderSpacer,
} from '@/components/main-header-overlay';
import { CollectionPlayingOverlay } from '@/components/now-playing-artwork';
import PlaylistCover from '@/components/playlist-cover';
import MainNativeHeader from '@/components/main-native-header';
import MainScreenBackground from '@/components/main-screen-background';
import SongListRow from '@/components/song-list-row';
import { useAuth } from '@/providers/auth-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref, useDetailRoutes } from '@/services/action-sheet';
import { RecommendationStyle } from '@/services/auth';
import { measureOperation, reportError } from '@/services/telemetry';
import {
  isAccountDeleted,
  registerAccountCleanup,
} from '@/services/account-lifecycle';
import {
  CrimsonArtist,
  CrimsonPlaylist,
  CrimsonSong,
  loadHomeFeed,
  loadVaultMood,
  readOfflineData,
  VaultMood,
} from '@/services/music';

const defaultArtistImage = require('@/assets/images/home/default-artist.webp');
const vaultMoods: { mood: VaultMood; icon: SymbolViewProps['name'] }[] = [
  {
    mood: 'Chill',
    icon: { ios: 'moon.stars.fill', android: 'bedtime', web: 'bedtime' },
  },
  {
    mood: 'Focus',
    icon: {
      ios: 'scope',
      android: 'center_focus_strong',
      web: 'center_focus_strong',
    },
  },
  {
    mood: 'Melancholy',
    icon: { ios: 'cloud.rain.fill', android: 'rainy', web: 'rainy' },
  },
  {
    mood: 'Motivation',
    icon: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  },
  {
    mood: 'Party',
    icon: { ios: 'sparkles', android: 'celebration', web: 'celebration' },
  },
  {
    mood: 'Romantic',
    icon: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  },
];
const homeSessionRotation = Date.now();
type HomeFeed = Awaited<ReturnType<typeof loadHomeFeed>>;
type HomeScreenProps = {
  personalizationOverride?: {
    favoriteCategories: string[];
    recommendationStyle: RecommendationStyle;
  };
};

const homeSessionFeeds = new Map<string, Promise<HomeFeed>>();
const homeSessionFeedValues = new Map<string, HomeFeed>();
registerAccountCleanup((uid) => {
  for (const key of homeSessionFeeds.keys())
    if (key.startsWith(`${uid}:`)) homeSessionFeeds.delete(key);
  for (const key of homeSessionFeedValues.keys())
    if (key.startsWith(`${uid}:`)) homeSessionFeedValues.delete(key);
});

function homeFeedCacheKey(uid?: string, personalizationKey = '') {
  return `${uid || 'signed-out'}:${personalizationKey}`;
}

function loadHomeSessionFeed(
  uid: string | undefined,
  personalizationKey: string,
  rotation: number,
  profile: DiscoveryProfile,
  onSongsReady: (songs: CrimsonSong[]) => void,
) {
  const cacheKey = homeFeedCacheKey(uid, personalizationKey);
  const cached = homeSessionFeeds.get(cacheKey);
  if (cached) return cached;

  const startedAt = performance.now();
  const pending = measureOperation('home.feed', () =>
    loadHomeFeed(
      uid,
      rotation,
      (songs) => {
        onSongsReady(songs);
        if (__DEV__)
          console.info(
            `[Crimson:timing] home.first-content: ${Math.round(performance.now() - startedAt)}ms`,
          );
      },
      profile,
    ),
  )
    .then((feed) => {
      if (uid && isAccountDeleted(uid)) return feed;
      homeSessionFeedValues.set(cacheKey, feed);
      while (homeSessionFeedValues.size > 12) {
        const oldest = homeSessionFeedValues.keys().next().value!;
        homeSessionFeedValues.delete(oldest);
        homeSessionFeeds.delete(oldest);
      }
      return feed;
    })
    .catch((error) => {
      homeSessionFeeds.delete(cacheKey);
      homeSessionFeedValues.delete(cacheKey);
      throw error;
    });
  homeSessionFeeds.set(cacheKey, pending);
  return pending;
}

export default function HomeScreen({
  personalizationOverride,
}: HomeScreenProps = {}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  const [contentWidth, setContentWidth] = useState(0);
  const [hoveredCard, setHoveredCard] = useState('');
  const desktopColumns = Math.max(3, Math.min(7, Math.floor((contentWidth || width - 320) / 176)));
  const desktopCardWidth = Math.min(196, Math.floor(((contentWidth || width - 320) - 16 * (desktopColumns - 1)) / desktopColumns));
  const { artistHref, playlistHref } = useDetailRoutes();
  const insets = useSafeAreaInsets();
  const headerScroll = useMainHeaderScroll();
  const [vaultCopyBottom, setVaultCopyBottom] = useState(68);
  const { user } = useAuth();
  const { playSong } = usePlayer();
  const { colors, performanceMode, reduceMotion, dataSaver } = useAppSettings();
  const favoriteCategories =
    personalizationOverride?.favoriteCategories ??
    user?.FavoriteCategories ??
    [];
  const recommendationStyle =
    personalizationOverride?.recommendationStyle ??
    user?.RecommendationStyle ??
    '';
  const [rotation, setRotation] = useState(homeSessionRotation);
  const { isOffline } = useNetwork();
  const [refreshing, setRefreshing] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const profile = {
    favoriteCategories,
    recommendationStyle: recommendationStyle || 'balanced',
  } as DiscoveryProfile;
  const personalizationKey = [
    ...favoriteCategories,
    recommendationStyle,
    String(dataSaver),
    String(rotation),
  ].join(':');
  const homeFeedKey = homeFeedCacheKey(user?.uid, personalizationKey);
  const cachedFeed = homeSessionFeedValues.get(homeFeedKey);
  const [songs, setSongs] = useState<CrimsonSong[]>(
    () => cachedFeed?.songs ?? [],
  );
  const [artists, setArtists] = useState<CrimsonArtist[]>(
    () => cachedFeed?.artists ?? [],
  );
  const [playlists, setPlaylists] = useState<CrimsonPlaylist[]>(
    () => cachedFeed?.playlists ?? [],
  );
  const [featuredArtist, setFeaturedArtist] = useState<CrimsonArtist | null>(
    () => cachedFeed?.featuredArtist ?? null,
  );
  const [loadedFeedKey, setLoadedFeedKey] = useState<string | null>(() =>
    cachedFeed ? homeFeedKey : null,
  );
  const [newReleases, setNewReleases] = useState<CrimsonSong[]>(
    cachedFeed?.newReleases || [],
  );
  const vaultVariation = useRef(0);
  const [vaultOpen, setVaultOpen] = useState(false);
  const vaultOpenRef = useRef(false);
  const vaultTransitionRevision = useRef(0);
  const [vaultLoadingMood, setVaultLoadingMood] = useState<VaultMood | null>(
    null,
  );
  const vaultLoadingRef = useRef(false);
  const vaultMountedRef = useRef(true);
  const [vaultExpansion] = useState(() => new Animated.Value(0));
  const [vaultOpenerOffset] = useState(() => new Animated.Value(0));
  const [vaultMoodsOffset] = useState(() => new Animated.Value(280));
  const [skeletonShimmer] = useState(() => new Animated.Value(0));
  const [songsFeedKey, setSongsFeedKey] = useState<string | null>(
    cachedFeed ? homeFeedKey : null,
  );
  const loading = loadedFeedKey !== homeFeedKey;
  const songsLoading = loading && songsFeedKey !== homeFeedKey;

  useEffect(() => {
    let active = true;
    let fresh = false;
    // Hydrate persisted content while independent network sources refresh.
    void readOfflineData<HomeFeed>(
      `home:${user?.uid || 'guest'}:${preferredGenres(profile).join(',')}:${recommendationStyle || 'balanced'}`,
    ).then((feed) => {
      if (!active || fresh || !feed) return;
      setSongs(feed.songs);
      setArtists(feed.artists);
      setPlaylists(feed.playlists);
      setFeaturedArtist(feed.featuredArtist);
      setNewReleases(feed.newReleases || []);
      setLoadedFeedKey(homeFeedKey);
    });
    loadHomeSessionFeed(
      user?.uid,
      personalizationKey,
      rotation,
      {
        favoriteCategories,
        recommendationStyle: recommendationStyle || 'balanced',
      },
      (nextSongs) => {
        if (active) {
          setSongs(nextSongs);
          setSongsFeedKey(homeFeedKey);
        }
      },
    )
      .then((feed) => {
        if (!active) return;
        fresh = true;
        setFeedError(null);
        setSongs(feed.songs);
        setArtists(feed.artists);
        setPlaylists(feed.playlists);
        setFeaturedArtist(feed.featuredArtist);
        setNewReleases(feed.newReleases || []);
      })
      .catch((error) => {
        reportError(error, 'home.feed');
        if (active)
          setFeedError(
            'Could not refresh your music. Your saved content is still available.',
          );
      })
      .finally(() => {
        if (active) {
          setLoadedFeedKey(homeFeedKey);
          setRefreshing(false);
        }
      });
    return () => {
      active = false;
    };
    // The stable personalization key includes every discovery preference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeFeedKey, personalizationKey, user?.uid]);

  const refresh = () => {
    setFeedError(null);
    setRefreshing(true);
    setRotation(Date.now());
  };

  useEffect(() => {
    skeletonShimmer.stopAnimation();
    if (!loading || performanceMode || reduceMotion) {
      skeletonShimmer.setValue(performanceMode || reduceMotion ? 0.45 : 0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(skeletonShimmer, {
        toValue: 1,
        duration: 1250,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [loading, performanceMode, reduceMotion, skeletonShimmer]);

  useEffect(() => {
    vaultMountedRef.current = true;
    return () => {
      vaultMountedRef.current = false;
      vaultExpansion.stopAnimation();
      vaultOpenerOffset.stopAnimation();
      vaultMoodsOffset.stopAnimation();
    };
  }, [vaultExpansion, vaultMoodsOffset, vaultOpenerOffset]);

  const transitionVault = async (open: boolean) => {
    if (vaultOpenRef.current === open) return;
    // Visible controls respond immediately, even while the spring is settling.
    // A new direction cancels the old sequence and continues from its position.
    vaultOpenRef.current = open;
    setVaultOpen(open);
    const revision = ++vaultTransitionRevision.current;
    vaultExpansion.stopAnimation();
    vaultOpenerOffset.stopAnimation();
    vaultMoodsOffset.stopAnimation();
    if (reduceMotion || performanceMode) {
      vaultExpansion.setValue(open ? 1 : 0);
      vaultOpenerOffset.setValue(open ? 80 : 0);
      vaultMoodsOffset.setValue(open ? 0 : 280);
      return;
    }

    const run = (animation: Animated.CompositeAnimation) =>
      new Promise<boolean>((resolve) => {
        animation.start(({ finished }) =>
          resolve(finished && vaultMountedRef.current && revision === vaultTransitionRevision.current),
        );
      });
    const exit = (value: Animated.Value, toValue: number) =>
      Animated.timing(value, {
        toValue, duration: 140, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web',
      });
    const spring = (value: Animated.Value, toValue: number, useNativeDriver: boolean) =>
      Animated.spring(value, {
        toValue, stiffness: 260, damping: 21, mass: 0.9,
        restDisplacementThreshold: useNativeDriver ? 0.5 : 0.005,
        restSpeedThreshold: useNativeDriver ? 3 : 0.05,
        useNativeDriver: useNativeDriver && Platform.OS !== 'web',
      });

    // Keep native glass mounted and opaque. Each group slides behind a fixed
    // clip instead of swapping material views during the height animation.
    if (open) {
      if (!(await run(exit(vaultOpenerOffset, 80)))) return;
      if (!(await run(Animated.parallel([
        spring(vaultExpansion, 1, false),
        spring(vaultMoodsOffset, 0, true),
      ])))) return;
    } else {
      if (!(await run(exit(vaultMoodsOffset, 280)))) return;
      if (!(await run(Animated.parallel([
        spring(vaultExpansion, 0, false),
        spring(vaultOpenerOffset, 0, true),
      ])))) return;
    }
  };

  const openSong = (song: CrimsonSong) => {
    playSong(song, songs, 'Home');
  };

  const openSongActions = (song: CrimsonSong) => {
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
  };

  const openArtistActions = (artist: CrimsonArtist) => {
    router.push(
      actionSheetHref({
        type: 'artist',
        id: artist.id,
        title: artist.name,
        subtitle: `${artist.followers} followers`,
        image: artist.imageSmall || artist.image,
      }),
    );
  };

  const openPlaylistActions = (playlist: CrimsonPlaylist) => {
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
    );
  };

  const chooseVaultMood = async (mood: VaultMood) => {
    if (!vaultOpenRef.current || vaultLoadingRef.current) return;
    const openedRevision = vaultTransitionRevision.current;
    vaultLoadingRef.current = true;
    setVaultLoadingMood(mood);
    try {
      const queue = await loadVaultMood(
        mood,
        user?.uid,
        ++vaultVariation.current,
      );
      if (!vaultMountedRef.current) return;
      if (!queue.length) {
        Alert.alert(
          `The Vault · ${mood}`,
          'Crimson could not find enough songs for this mood right now. Please try again.',
        );
        return;
      }
      playSong(queue[0], queue, `The Vault · ${mood}`);
      if (openedRevision === vaultTransitionRevision.current) void transitionVault(false);
    } catch {
      if (vaultMountedRef.current)
        Alert.alert(
          `The Vault · ${mood}`,
          'Could not build this mood mix. Check your connection and try again.',
        );
    } finally {
      vaultLoadingRef.current = false;
      if (vaultMountedRef.current) setVaultLoadingMood(null);
    }
  };

  const vaultHeight = vaultExpansion.interpolate({
    inputRange: [0, 1],
    outputRange: desktop ? [190, 286] : [Math.max(140, vaultCopyBottom + 90), Math.max(348, vaultCopyBottom + 292)],
  });
  const vaultBackgroundScale = vaultExpansion.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const vaultBorderColor = vaultExpansion.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(182,140,255,0.42)', 'rgba(206,178,255,0.82)'],
  });
  const vaultShadowOpacity = vaultExpansion.interpolate({
    inputRange: [0, 1],
    outputRange: [0.34, 0.58],
  });

  return (
    <MainScreenBackground overlay={<MainHeaderOverlay
        compact={!personalizationOverride}
        title="Home"
        offset={headerScroll.offset}
      />}>
      <MainNativeHeader
        offset={headerScroll.offset}
        title="Home"
        preview={Boolean(personalizationOverride)}
      />
      <Reanimated.ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            // Content padding does not move the native refresh indicator.
            progressViewOffset={Platform.OS === 'web' ? undefined : insets.top}
          />
        }
        alwaysBounceVertical
        bounces
        contentInsetAdjustmentBehavior="never"
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          desktop && styles.desktopContent,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 150 },
        ]}
      >
        <MainHeaderSpacer title="Home" />
        <View onLayout={({ nativeEvent: { layout } }) => setContentWidth(layout.width)} />

        <Animated.View
          style={[
            styles.vault,
            {
              height: vaultHeight,
              borderColor: vaultBorderColor,
              shadowOpacity: vaultShadowOpacity,
            },
          ]}
        >
          <FrostedLayer style={StyleSheet.absoluteFill} background={<>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ scale: vaultBackgroundScale }] },
            ]}
          >
            <Image
              autoplay={!reduceMotion && !performanceMode}
              contentFit="cover"
              source={require('@/assets/images/home/vault-background.webp')}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          </>}>
          {desktop ? (
            <View style={styles.desktopVaultContent}>
              <View style={styles.desktopVaultCopy}>
                <Text style={styles.desktopVaultTitle}>The Vault</Text>
                <Text style={styles.desktopVaultDescription}>A fresh mix from Audius, tuned to your mood.</Text>
              </View>
              <View style={styles.desktopVaultActions}>
                {vaultOpen ? (
                  <>
                    <View style={styles.desktopMoods}>
                      {vaultMoods.map(({ mood, icon }) => (
                        <VaultGlassButton key={mood} accessibilityLabel={`Play ${mood} from The Vault`}
                          disabled={Boolean(vaultLoadingMood)} height={52}
                          onPress={() => void chooseVaultMood(mood)} style={styles.desktopMood} contentStyle={styles.moodContent}>
                          {vaultLoadingMood === mood ? <ActivityIndicator color="#E7E0FF" size="small" /> : <>
                            <SymbolView name={icon} size={15} tintColor="#E7E0FF" />
                            <Text style={styles.moodText}>{mood}</Text>
                          </>}
                        </VaultGlassButton>
                      ))}
                    </View>
                    <VaultGlassButton accessibilityLabel="Close Vault moods" onPress={() => void transitionVault(false)}
                      style={styles.vaultCloseButton} contentStyle={styles.moodContent}>
                      <SymbolView name="xmark" size={15} tintColor="#E7E0FF" />
                      <Text style={styles.moodText}>Close</Text>
                    </VaultGlassButton>
                  </>
                ) : (
                  <VaultGlassButton accessibilityLabel="Open Vault" height={56} onPress={() => void transitionVault(true)}
                    style={styles.desktopVaultButton} contentStyle={styles.moodContent}>
                    <SymbolView name="play.fill" size={18} tintColor="#FFFFFF" />
                    <Text style={styles.moodText}>Find my mix</Text>
                  </VaultGlassButton>
                )}
              </View>
            </View>
          ) : <>
          <View onLayout={({ nativeEvent: { layout } }) => setVaultCopyBottom(Math.ceil(layout.y + layout.height))} style={styles.vaultPrimary}>
            <Text style={styles.vaultTitle}>VAULT</Text>
          </View>
          <View
            pointerEvents={vaultOpen ? 'none' : 'auto'}
            accessibilityElementsHidden={vaultOpen}
            importantForAccessibility={vaultOpen ? 'no-hide-descendants' : 'auto'}
            style={[styles.vaultOpenerClip, { top: vaultCopyBottom }]}
          >
            <Animated.View style={[styles.vaultOpener, { transform: [{ translateY: vaultOpenerOffset }] }]}>
              <VaultGlassButton
                accessibilityLabel="Open Vault"
                height={56}
                onPress={() => void transitionVault(true)}
                style={styles.vaultPlayButton}
                contentStyle={{ flexDirection: 'row', gap: 10 }}
              >
                <SymbolView
                  name={{
                    ios: 'play.fill',
                    android: 'play_arrow',
                    web: 'play_arrow',
                  }}
                  size={21}
                  tintColor="#FFFFFF"
                  weight="semibold"
                />
              </VaultGlassButton>
            </Animated.View>
          </View>
          <View
            pointerEvents={vaultOpen ? 'auto' : 'none'}
            accessibilityElementsHidden={!vaultOpen}
            importantForAccessibility={vaultOpen ? 'auto' : 'no-hide-descendants'}
            style={[styles.vaultMoodClip, { top: vaultCopyBottom + 28 }]}
          >
            <Animated.View style={{ transform: [{ translateY: vaultMoodsOffset }] }}>
              <View style={styles.vaultMoodGroup}>
                <View style={styles.moods}>
                  {vaultMoods.map(({ mood, icon }) => (
                    <VaultGlassButton
                      key={mood}
                      accessibilityLabel={`Play ${mood} from The Vault`}
                      disabled={Boolean(vaultLoadingMood)}
                      height={52}
                      onPress={() => void chooseVaultMood(mood)}
                      style={styles.moodItem}
                      contentStyle={styles.moodContent}
                    >
                      {vaultLoadingMood === mood ? (
                        <ActivityIndicator color="#E7E0FF" size="small" />
                      ) : (
                        <>
                          <SymbolView
                            name={icon}
                            size={16}
                            tintColor={BrandAccent.highlight}
                            weight="semibold"
                          />
                          <Text style={styles.moodText}>{mood}</Text>
                        </>
                      )}
                    </VaultGlassButton>
                  ))}
                </View>
                <VaultGlassButton
                  accessibilityLabel="Close Vault moods"
                  height={52}
                  onPress={() => void transitionVault(false)}
                  style={styles.vaultCloseButton}
                  contentStyle={styles.moodContent}
                >
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' }}
                    size={15}
                    tintColor="#E7E0FF"
                    weight="semibold"
                  />
                  <Text style={styles.moodText}>Close</Text>
                </VaultGlassButton>
              </View>
            </Animated.View>
          </View>
          </>}
          </FrostedLayer>
        </Animated.View>

        {!personalizationOverride ? <HomeQuickAccess /> : null}
        {feedError ? (
          <Pressable
            accessibilityRole="button"
            onPress={refresh}
            style={{ paddingVertical: 12 }}
          >
            <Text style={{ color: colors.secondaryText }}>{feedError}</Text>
            <Text
              style={{ color: colors.accent, fontWeight: '700', marginTop: 6 }}
            >
              Try again
            </Text>
          </Pressable>
        ) : null}
        {newReleases.length ? (
          <>
            <SectionHeader
              title="From artists you follow"
              subtitle="Their latest tracks on Audius"
            />
            <View style={[styles.songList, desktop && styles.desktopSongGrid]}>
              {newReleases.slice(0, desktop ? 6 : 3).map((song) => (
                <View key={song.id} style={desktop && [styles.desktopSongCell, { width: ((contentWidth || width - 360) - 24) / 2 }]}>
                <SongListRow
                  key={song.id}
                  song={song}
                  onPress={() =>
                    playSong(song, newReleases, 'Artists you follow')
                  }
                  onMenuPress={() => openSongActions(song)}
                />
                </View>
              ))}
            </View>
          </>
        ) : null}
        <SectionHeader title="Artists worth checking out" />
        <ScrollView
          horizontal
          alwaysBounceHorizontal
          bounces
          showsHorizontalScrollIndicator={false}
          style={styles.fullBleedCarousel}
          contentContainerStyle={[styles.artistList, desktop && styles.desktopCarousel]}
        >
          {loading ? (
            <ArtistListSkeleton shimmer={skeletonShimmer} />
          ) : (
            artists.map((artist) => (
              <Pressable
                key={artist.id}
                onHoverIn={() => setHoveredCard(`artist:${artist.id}`)}
                onHoverOut={() => setHoveredCard('')}
                accessibilityRole="button"
                onPress={() => router.push(artistHref(artist.id))}
                onLongPress={() => openArtistActions(artist)}
                delayLongPress={350}
                style={({ pressed }) => [
                  styles.artist,
                  desktop && [styles.desktopCard, { width: desktopCardWidth }],
                  desktop && hoveredCard === `artist:${artist.id}` && { backgroundColor: colors.controlSurface },
                  pressed && styles.artistPressed,
                  pressed && !reduceMotion && styles.artistPressedScale,
                ]}
              >
                <View style={[styles.artistHalo, desktop && { width: desktopCardWidth - 16, height: desktopCardWidth - 16, borderRadius: 999, borderWidth: 0 }]}>
                  <View style={[styles.artistImageWrap, desktop && { width: desktopCardWidth - 16, height: desktopCardWidth - 16, borderRadius: 999 }]}>
                    <ArtworkImage
                      artwork={artist.artwork}
                      fallbackSource={defaultArtistImage}
                      contentFit="cover"
                      source={
                        artist.imageSmall
                          ? { uri: artist.imageSmall }
                          : defaultArtistImage
                      }
                      style={StyleSheet.absoluteFill}
                    />
                    <CollectionPlayingOverlay
                      sourceName={artist.name}
                      spectrumSize={42}
                    />
                  </View>
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.artistName, { color: colors.text }]}
                >
                  {artist.name}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SectionHeader
              title="Picked for you"
              subtitle={
                preferredGenres(profile).length
                  ? `Inspired by ${preferredGenres(profile).slice(0, 2).join(' & ')}`
                  : 'Discover your next favorite'
              }
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show me different recommendations"
            disabled={refreshing || isOffline}
            hitSlop={10}
            onPress={refresh}
          >
            <Text style={{ color: colors.accent, fontWeight: '700' }}>
              Refresh
            </Text>
          </Pressable>
        </View>

        <View style={[styles.songList, desktop && !songsLoading && styles.desktopSongGrid]}>
          {songsLoading ? (
            <SongListSkeleton shimmer={skeletonShimmer} />
          ) : (
            songs.map((song) => (
              <View key={song.id} style={desktop && [styles.desktopSongCell, { width: ((contentWidth || width - 360) - 24) / 2 }]}>
              <SongListRow
                key={song.id}
                song={song}
                onPress={() => openSong(song)}
                onMenuPress={() => openSongActions(song)}
              />
              </View>
            ))
          )}
        </View>

        <View style={styles.playlistHeading}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Trending on{' '}
          </Text>
          <Text style={[styles.playlistHighlight, { color: colors.accent }]}>
            Audius
          </Text>
        </View>
        <ScrollView
          horizontal
          alwaysBounceHorizontal
          bounces
          showsHorizontalScrollIndicator={false}
          style={styles.fullBleedCarousel}
          contentContainerStyle={[styles.playlistList, desktop && styles.desktopCarousel]}
        >
          {loading ? (
            <PlaylistListSkeleton shimmer={skeletonShimmer} />
          ) : (
            playlists.map((playlist) => (
              <Pressable
                key={playlist.id}
                onHoverIn={() => setHoveredCard(`playlist:${playlist.id}`)}
                onHoverOut={() => setHoveredCard('')}
                accessibilityRole="button"
                onPress={() =>
                  router.push(
                    playlistHref(
                      playlist.id,
                      false,
                      playlist.source,
                      playlist.title,
                    ),
                  )
                }
                onLongPress={() => openPlaylistActions(playlist)}
                delayLongPress={350}
                style={({ pressed }) => [
                  styles.playlistCard,
                  desktop && [styles.desktopCard, { width: desktopCardWidth }],
                  desktop && hoveredCard === `playlist:${playlist.id}` && { backgroundColor: colors.controlSurface },
                  pressed && styles.artistPressed,
                  pressed && !reduceMotion && styles.artistPressedScale,
                ]}
              >
                <PlaylistCover
                  playlist={playlist}
                  style={[styles.playlistArtwork, desktop && { width: desktopCardWidth - 16, height: desktopCardWidth - 16 }]}
                />
                <Text
                  numberOfLines={1}
                  style={[styles.playlistTitle, { color: colors.text }]}
                >
                  {playlist.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.playlistSubtitle,
                    { color: colors.secondaryText },
                  ]}
                >
                  {playlist.artists}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>

        {loading ? <FeatureSkeleton shimmer={skeletonShimmer} /> : null}
        <HomeDiscovery artist={loading ? null : featuredArtist} profile={profile} rotation={rotation}
          contentWidth={contentWidth} excludeTrackIds={[...songs, ...newReleases].map((song) => song.id)}
          onOpenArtist={(artist) => router.push(artistHref(artist.id))}
          onArtistMenu={openArtistActions} onSongMenu={openSongActions} />
      </Reanimated.ScrollView>

    </MainScreenBackground>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const { colors } = useAppSettings();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: colors.secondaryText }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function SongListSkeleton({ shimmer }: { shimmer: Animated.Value }) {
  const { colors } = useAppSettings();
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <View
          key={index}
          style={[styles.skeletonSongRow, { backgroundColor: colors.elevated }]}
        >
          <SkeletonBlock shimmer={shimmer} style={styles.skeletonSongArtwork} />
          <View style={styles.skeletonSongCopy}>
            <SkeletonBlock
              shimmer={shimmer}
              style={[styles.skeletonLine, { width: `${68 - index * 4}%` }]}
            />
            <SkeletonBlock
              shimmer={shimmer}
              style={[
                styles.skeletonSmallLine,
                { width: `${40 + index * 3}%` },
              ]}
            />
          </View>
          <SkeletonBlock shimmer={shimmer} style={styles.skeletonMenu} />
        </View>
      ))}
    </>
  );
}

function ArtistListSkeleton({ shimmer }: { shimmer: Animated.Value }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <View key={index} style={styles.artist}>
          <SkeletonBlock shimmer={shimmer} style={styles.skeletonArtist} />
          <SkeletonBlock
            shimmer={shimmer}
            style={[styles.skeletonArtistName, { width: index % 2 ? 58 : 72 }]}
          />
        </View>
      ))}
    </>
  );
}

function PlaylistListSkeleton({ shimmer }: { shimmer: Animated.Value }) {
  return (
    <>
      {Array.from({ length: 3 }, (_, index) => (
        <View key={index} style={styles.playlistCard}>
          <SkeletonBlock
            shimmer={shimmer}
            style={styles.skeletonPlaylistArtwork}
          />
          <SkeletonBlock
            shimmer={shimmer}
            style={[
              styles.skeletonPlaylistTitle,
              { width: index === 1 ? 92 : 108 },
            ]}
          />
          <SkeletonBlock
            shimmer={shimmer}
            style={[
              styles.skeletonPlaylistSubtitle,
              { width: index === 2 ? 74 : 88 },
            ]}
          />
        </View>
      ))}
    </>
  );
}

function FeatureSkeleton({ shimmer }: { shimmer: Animated.Value }) {
  const { colors } = useAppSettings();
  return (
    <View style={styles.featureSection}>
      <Text
        style={[
          styles.sectionTitle,
          styles.skeletonFeatureHeading,
          { color: colors.text },
        ]}
      >
        Artist spotlight
      </Text>
      <View
        style={[
          styles.skeletonFeatureCard,
          { backgroundColor: colors.elevated },
        ]}
      >
        <SkeletonBlock shimmer={shimmer} style={styles.skeletonFeatureImage} />
        <View style={styles.skeletonFeatureInfo}>
          <SkeletonBlock shimmer={shimmer} style={styles.skeletonFeatureName} />
          <SkeletonBlock
            shimmer={shimmer}
            style={styles.skeletonFeatureFollowers}
          />
          <SkeletonBlock
            shimmer={shimmer}
            style={styles.skeletonFeatureButton}
          />
        </View>
      </View>
    </View>
  );
}

function SkeletonBlock({
  shimmer,
  style,
}: {
  shimmer: Animated.Value;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, isDark } = useAppSettings();
  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-220, 440],
  });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.skeletonBlock,
        { backgroundColor: colors.surfaceStrong },
        style,
      ]}
    >
      <Animated.View
        style={[styles.skeletonShimmer, { transform: [{ translateX }] }]}
      >
        <LinearGradient
          colors={
            isDark
              ? [
                  'rgba(255,255,255,0)',
                  'rgba(255,255,255,0.10)',
                  'rgba(255,255,255,0)',
                ]
              : [
                  'rgba(255,255,255,0)',
                  'rgba(255,255,255,0.72)',
                  'rgba(255,255,255,0)',
                ]
          }
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopContent: { paddingHorizontal: 28, width: '100%', maxWidth: 1440, alignSelf: 'center' },
  desktopVaultContent: { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, gap: 24 },
  desktopVaultCopy: { flex: 1, gap: 9 },
  desktopVaultTitle: { color: '#FFFFFF', fontSize: 42, lineHeight: 48, letterSpacing: -1.5, fontWeight: '800' },
  desktopVaultDescription: { color: '#D4C4E8', fontSize: 14, lineHeight: 21, maxWidth: 310 },
  desktopVaultActions: { width: '48%', alignItems: 'flex-end', gap: 12 },
  desktopVaultButton: { width: 200 },
  desktopMoods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%' },
  desktopMood: { width: '48%' },
  desktopSongGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 4 },
  desktopSongCell: { minWidth: 0 },
  desktopCarousel: { gap: 16, paddingBottom: 6 },
  desktopCard: { padding: 8, borderRadius: 12, alignItems: 'stretch', gap: 0 },
  screen: { flex: 1, backgroundColor: '#0E0D13' },
  scrollContent: { paddingHorizontal: 20 },
  vault: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: BrandAccent.glow,
    shadowRadius: 64,
    shadowOffset: { width: 0, height: -28 },
  },
  vaultPrimary: {
    position: 'absolute',
    top: 16,
    left: 22,
    right: 22,
    alignItems: 'center',
    gap: 6,
  },
  vaultTitle: {
    color: '#E7E0FF',
    fontSize: 25,
    fontWeight: '500',
    letterSpacing: 1.1,
  },
  vaultOpenerClip: {
    position: 'absolute',
    height: 80,
    left: 22,
    right: 22,
    overflow: 'hidden',
  },
  vaultOpener: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultPlayButton: { width: '44%', minWidth: 144, maxWidth: 200 },
  vaultMoodClip: { position: 'absolute', height: 264, paddingTop: 16, left: 12, right: 12, overflow: 'hidden' },
  vaultMoodGroup: { alignItems: 'center', gap: 12 },
  moods: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  moodItem: { width: '48%' },
  vaultCloseButton: { width: 104 },
  moodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  moodText: { color: '#E7E0FF', fontSize: 14, fontWeight: '700' },
  sectionHeader: { marginTop: 24, marginBottom: 10 },
  sectionTitle: {
    color: '#DCD6F7',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.45,
  },
  sectionSubtitle: {
    marginTop: 4,
    color: '#8A85A1',
    fontSize: 12,
    lineHeight: 16,
  },
  songList: { gap: 7 },
  fullBleedCarousel: { marginHorizontal: -20 },
  artistList: { gap: 12, paddingHorizontal: 20 },
  artist: { width: 142, alignItems: 'center', gap: 7 },
  artistPressed: { opacity: 0.82 },
  artistPressedScale: { transform: [{ scale: 0.96 }] },
  artistHalo: {
    width: 142,
    height: 142,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 71,
    borderWidth: 2,
    borderColor: 'rgba(220,214,247,0.72)',
    backgroundColor: brandAccentTint(0.13),
  },
  artistImageWrap: {
    width: 134,
    height: 134,
    overflow: 'hidden',
    borderRadius: 67,
  },
  artistName: {
    width: '92%',
    color: '#DCD6F7',
    fontSize: 13,
    textAlign: 'center',
  },
  playlistHeading: {
    marginTop: 24,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  playlistHighlight: {
    color: BrandAccent.dark,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.45,
  },
  playlistList: { gap: 11, paddingHorizontal: 20 },
  playlistCard: { width: 142 },
  playlistArtwork: {
    width: 142,
    height: 142,
    borderRadius: 17,
    backgroundColor: '#1F1D23',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(220,214,247,0.22)',
  },
  playlistTitle: {
    marginTop: 8,
    color: '#DCD6F7',
    fontSize: 15,
    fontWeight: '700',
  },
  playlistSubtitle: { marginTop: 2, color: '#8A85A1', fontSize: 12 },
  featureSection: { marginTop: 32, gap: 14 },
  skeletonBlock: { overflow: 'hidden' },
  skeletonShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 160,
  },
  skeletonSongRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(34,29,42,0.38)',
  },
  skeletonSongArtwork: { width: 42, height: 42, borderRadius: 8 },
  skeletonSongCopy: { flex: 1, gap: 7 },
  skeletonLine: { height: 13, borderRadius: 6 },
  skeletonSmallLine: { height: 9, borderRadius: 5 },
  skeletonMenu: { width: 24, height: 7, marginRight: 8, borderRadius: 4 },
  skeletonArtist: { width: 142, height: 142, borderRadius: 71 },
  skeletonArtistName: { height: 11, borderRadius: 6 },
  skeletonPlaylistArtwork: { width: 142, height: 142, borderRadius: 17 },
  skeletonPlaylistTitle: { height: 13, marginTop: 9, borderRadius: 7 },
  skeletonPlaylistSubtitle: { height: 9, marginTop: 7, borderRadius: 5 },
  skeletonFeatureHeading: { opacity: 0.72 },
  skeletonFeatureCard: {
    height: 178,
    overflow: 'hidden',
    flexDirection: 'row',
    borderRadius: 22,
    backgroundColor: 'rgba(34,29,42,0.38)',
  },
  skeletonFeatureImage: { width: '45%', height: '100%' },
  skeletonFeatureInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 17,
  },
  skeletonFeatureName: { width: '82%', height: 24, borderRadius: 9 },
  skeletonFeatureFollowers: {
    width: '58%',
    height: 11,
    marginTop: 10,
    borderRadius: 6,
  },
  skeletonFeatureButton: {
    width: '100%',
    height: 42,
    marginTop: 22,
    borderRadius: 15,
  },
});
