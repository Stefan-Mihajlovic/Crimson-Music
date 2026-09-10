import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Reanimated from 'react-native-reanimated';
import { useMainHeaderScroll } from '@/hooks/use-main-header-scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import VaultGlassButton, { VaultGlassGroup, VaultGlassSurface } from '@/components/vault-glass-button';
import MainHeaderOverlay, { MainHeaderSpacer } from '@/components/main-header-overlay';
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
import { isAccountDeleted, registerAccountCleanup } from '@/services/account-lifecycle';
import { CrimsonArtist, CrimsonPlaylist, CrimsonSong, loadHomeFeed, loadVaultMood, readOfflineData, VaultMood } from '@/services/music';

const defaultArtistImage = require('@/assets/images/home/default-artist.webp');
const vaultMoods: { mood: VaultMood; icon: SymbolViewProps['name'] }[] = [
  { mood: 'Chill', icon: { ios: 'moon.stars.fill', android: 'bedtime', web: 'bedtime' } },
  { mood: 'Focus', icon: { ios: 'scope', android: 'center_focus_strong', web: 'center_focus_strong' } },
  { mood: 'Melancholy', icon: { ios: 'cloud.rain.fill', android: 'rainy', web: 'rainy' } },
  { mood: 'Motivation', icon: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' } },
  { mood: 'Party', icon: { ios: 'sparkles', android: 'celebration', web: 'celebration' } },
  { mood: 'Romantic', icon: { ios: 'heart.fill', android: 'favorite', web: 'favorite' } },
];
const homeSessionRotation = Date.now();
type HomeFeed = Awaited<ReturnType<typeof loadHomeFeed>>;
type VaultPhase = 'closed' | 'opening' | 'open' | 'closing';
type HomeScreenProps = {
  personalizationOverride?: {
    favoriteCategories: string[];
    recommendationStyle: RecommendationStyle;
  };
};

const homeSessionFeeds = new Map<string, Promise<HomeFeed>>();
const homeSessionFeedValues = new Map<string, HomeFeed>();
registerAccountCleanup((uid) => {
  for (const key of homeSessionFeeds.keys()) if (key.startsWith(`${uid}:`)) homeSessionFeeds.delete(key);
  for (const key of homeSessionFeedValues.keys()) if (key.startsWith(`${uid}:`)) homeSessionFeedValues.delete(key);
});

function homeFeedCacheKey(uid?: string, personalizationKey = '') {
  return `${uid || 'signed-out'}:${personalizationKey}`;
}

function loadHomeSessionFeed(uid?: string, personalizationKey = '', onSongsReady?: (songs: CrimsonSong[]) => void) {
  const cacheKey = homeFeedCacheKey(uid, personalizationKey);
  const cached = homeSessionFeeds.get(cacheKey);
  if (cached) return cached;

  const startedAt = performance.now();
  const pending = measureOperation('home.feed', () => loadHomeFeed(uid, homeSessionRotation, (songs) => {
    if (__DEV__) console.info(`[Crimson:timing] home.first-content: ${Math.round(performance.now() - startedAt)}ms`);
    onSongsReady?.(songs);
  }))
    .then((feed) => {
      if (uid && isAccountDeleted(uid)) return feed;
      homeSessionFeedValues.set(cacheKey, feed);
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

export default function HomeScreen({ personalizationOverride }: HomeScreenProps = {}) {
  const router = useRouter();
  const { artistHref, playlistHref } = useDetailRoutes();
  const insets = useSafeAreaInsets();
  const headerScroll = useMainHeaderScroll();
  const scrollRef = useRef<ScrollView>(null);
  const vaultTop = useRef(0);
  const { user } = useAuth();
  const { playSong } = usePlayer();
  const { colors, performanceMode, reduceMotion } = useAppSettings();
  const favoriteCategories = personalizationOverride?.favoriteCategories
    ?? user?.FavoriteCategories
    ?? [];
  const recommendationStyle = personalizationOverride?.recommendationStyle
    ?? user?.RecommendationStyle
    ?? '';
  const personalizationKey = [...favoriteCategories, recommendationStyle].join(':');
  const homeFeedKey = homeFeedCacheKey(user?.uid, personalizationKey);
  const cachedFeed = homeSessionFeedValues.get(homeFeedKey);
  const [songs, setSongs] = useState<CrimsonSong[]>(() => cachedFeed?.songs ?? []);
  const [artists, setArtists] = useState<CrimsonArtist[]>(() => cachedFeed?.artists ?? []);
  const [playlists, setPlaylists] = useState<CrimsonPlaylist[]>(() => cachedFeed?.playlists ?? []);
  const [featuredArtist, setFeaturedArtist] = useState<CrimsonArtist | null>(
    () => cachedFeed?.featuredArtist ?? null,
  );
  const [loadedFeedKey, setLoadedFeedKey] = useState<string | null>(
    () => cachedFeed ? homeFeedKey : null,
  );
  const [vaultPhase, setVaultPhase] = useState<VaultPhase>('closed');
  const vaultPhaseRef = useRef<VaultPhase>('closed');
  const [vaultControls, setVaultControls] = useState<'play' | 'moods' | null>('play');
  const [vaultLoadingMood, setVaultLoadingMood] = useState<VaultMood | null>(null);
  const vaultLoadingRef = useRef(false);
  const vaultMountedRef = useRef(true);
  const [vaultExpansion] = useState(() => new Animated.Value(0));
  const [vaultOpenerOffset] = useState(() => new Animated.Value(0));
  const [vaultMoodsOffset] = useState(() => new Animated.Value(240));
  const [skeletonShimmer] = useState(() => new Animated.Value(0));
  const loading = loadedFeedKey !== homeFeedKey;

  useEffect(() => {
    let active = true;
    let fresh = false;
    // Hydrate persisted content while independent network sources refresh.
    void readOfflineData<HomeFeed>(`home:${user?.uid || 'guest'}`).then((feed) => {
      if (!active || fresh || !feed) return;
      setSongs(feed.songs);
      setArtists(feed.artists);
      setPlaylists(feed.playlists);
      setFeaturedArtist(feed.featuredArtist);
      setLoadedFeedKey(homeFeedKey);
    });
    loadHomeSessionFeed(user?.uid, personalizationKey, (nextSongs) => {
      if (!active) return;
      fresh = true;
      setSongs(nextSongs);
      setLoadedFeedKey(homeFeedKey);
    })
      .then((feed) => {
        if (!active) return;
        fresh = true;
        setSongs(feed.songs);
        setArtists(feed.artists);
        setPlaylists(feed.playlists);
        setFeaturedArtist(feed.featuredArtist);
      })
      .catch((error) => {
        reportError(error, 'home.feed');
        if (active) Alert.alert('Could not load Crimson', 'Check your connection and try again.');
      })
      .finally(() => {
        if (active) setLoadedFeedKey(homeFeedKey);
      });
    return () => {
      active = false;
    };
  }, [homeFeedKey, personalizationKey, user?.uid]);

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
        useNativeDriver: true,
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
    // The ref closes the double-tap gap before React commits disabled buttons.
    if (vaultPhaseRef.current !== (open ? 'closed' : 'open')) return;
    vaultPhaseRef.current = open ? 'opening' : 'closing';
    setVaultPhase(vaultPhaseRef.current);

    const finish = () => {
      vaultPhaseRef.current = open ? 'open' : 'closed';
      setVaultPhase(vaultPhaseRef.current);
    };
    if (reduceMotion || performanceMode) {
      vaultExpansion.setValue(open ? 1 : 0);
      vaultOpenerOffset.setValue(open ? 80 : 0);
      vaultMoodsOffset.setValue(open ? 0 : 240);
      setVaultControls(open ? 'moods' : 'play');
      finish();
      return;
    }

    const move = (value: Animated.Value, toValue: number, duration: number, useNativeDriver = true) => (
      new Promise<boolean>((resolve) => {
        Animated.timing(value, {
          toValue,
          duration,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver,
        }).start(({ finished }) => resolve(finished && vaultMountedRef.current));
      })
    );

    // Each control group leaves before its replacement mounts. Translating
    // opaque glass also avoids UIKit's invisible-ancestor compositing issue.
    if (open) {
      if (!(await move(vaultOpenerOffset, 80, 110))) return;
      setVaultControls(null);
      if (!(await move(vaultExpansion, 1, 240, false))) return;
      setVaultControls('moods');
      if (!(await move(vaultMoodsOffset, 0, 180))) return;
    } else {
      if (!(await move(vaultMoodsOffset, 240, 150))) return;
      setVaultControls(null);
      if (!(await move(vaultExpansion, 0, 220, false))) return;
      setVaultControls('play');
      if (!(await move(vaultOpenerOffset, 0, 140))) return;
    }
    finish();
  };

  const openSong = (song: CrimsonSong) => {
    playSong(song, songs, 'Home');
  };

  const openSongActions = (song: CrimsonSong) => {
    router.push(actionSheetHref({
      type: 'song',
      id: song.id,
      title: song.title,
      subtitle: song.creator,
      image: song.imageSmall || song.image,
      artistId: song.artistId,
    }));
  };

  const openArtistActions = (artist: CrimsonArtist) => {
    router.push(actionSheetHref({
      type: 'artist',
      id: artist.id,
      title: artist.name,
      subtitle: `${artist.followers} followers`,
      image: artist.imageSmall || artist.image,
    }));
  };

  const openPlaylistActions = (playlist: CrimsonPlaylist) => {
    router.push(actionSheetHref({
      type: 'playlist',
      id: playlist.id,
      title: playlist.title,
      subtitle: playlist.artists,
      image: playlist.imageSmall || playlist.image,
      coverImages: playlist.coverImages,
      source: playlist.source,
    }));
  };

  const chooseVaultMood = async (mood: VaultMood) => {
    if (vaultPhaseRef.current !== 'open' || vaultLoadingRef.current) return;
    vaultLoadingRef.current = true;
    setVaultLoadingMood(mood);
    try {
      const queue = await loadVaultMood(mood, user?.uid);
      if (!vaultMountedRef.current) return;
      if (!queue.length) {
        Alert.alert(`The Vault · ${mood}`, 'Crimson could not find enough songs for this mood right now. Please try again.');
        return;
      }
      playSong(queue[0], queue, `The Vault · ${mood}`);
      void transitionVault(false);
    } catch {
      if (vaultMountedRef.current) Alert.alert(`The Vault · ${mood}`, 'Could not build this mood mix. Check your connection and try again.');
    } finally {
      vaultLoadingRef.current = false;
      if (vaultMountedRef.current) setVaultLoadingMood(null);
    }
  };

  const openVaultFromPlaylist = () => {
    void transitionVault(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        animated: !reduceMotion && !performanceMode,
        y: Math.max(0, vaultTop.current - insets.top - 52),
      });
    });
  };

  const vaultHeight = vaultExpansion.interpolate({ inputRange: [0, 1], outputRange: [154, 336] });
  const vaultBackgroundScale = vaultExpansion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const vaultBorderColor = vaultExpansion.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(182,140,255,0.42)', 'rgba(206,178,255,0.82)'],
  });
  const vaultShadowOpacity = vaultExpansion.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.58] });

  return (
    <MainScreenBackground>
      <MainNativeHeader offset={headerScroll.offset} title="Home" preview={Boolean(personalizationOverride)} />
      <Reanimated.ScrollView
        ref={scrollRef}
        alwaysBounceVertical
        bounces
        contentInsetAdjustmentBehavior="never"
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top, paddingBottom: insets.bottom + 150 }]}>
          <MainHeaderSpacer />

          <Animated.View
            onLayout={(event) => {
              vaultTop.current = event.nativeEvent.layout.y;
            }}
            style={[
              styles.vault,
              {
                height: vaultHeight,
                borderColor: vaultBorderColor,
                shadowOpacity: vaultShadowOpacity,
              },
            ]}>
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: vaultBackgroundScale }] }]}>
              <Image
                autoplay={!reduceMotion && !performanceMode}
                contentFit="cover"
                source={require('@/assets/images/home/vault-background.webp')}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <LinearGradient
              colors={['rgba(17,10,27,0.10)', 'rgba(17,10,27,0.48)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.vaultPrimary}>
              <Text style={styles.vaultTitle}>VAULT</Text>
              <Text style={styles.vaultDescription}>
                Pick a mood. The Vault builds a fresh mix from Audius.
              </Text>
            </View>
            {vaultControls === 'play' ? (
              <Animated.View
                pointerEvents={vaultPhase === 'closed' ? 'auto' : 'none'}
                accessibilityElementsHidden={vaultPhase !== 'closed'}
                importantForAccessibility={vaultPhase === 'closed' ? 'auto' : 'no-hide-descendants'}
                style={[styles.vaultOpener, { transform: [{ translateY: vaultOpenerOffset }] }]}>
                <VaultGlassButton
                  accessibilityLabel="Choose a Vault mood"
                  disabled={vaultPhase !== 'closed'}
                  height={48}
                  onPress={() => void transitionVault(true)}
                  style={styles.vaultPlayButton}>
                  <SymbolView
                    name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                    size={21}
                    tintColor="#FFFFFF"
                    weight="semibold"
                  />
                </VaultGlassButton>
              </Animated.View>
            ) : null}
            {vaultControls === 'moods' ? (
              <Animated.View
                pointerEvents={vaultPhase === 'open' ? 'auto' : 'none'}
                accessibilityElementsHidden={vaultPhase !== 'open'}
                importantForAccessibility={vaultPhase === 'open' ? 'auto' : 'no-hide-descendants'}
                style={[styles.vaultMoodPanel, { transform: [{ translateY: vaultMoodsOffset }] }]}>
                <VaultGlassGroup style={styles.vaultMoodGroup}>
                  <View style={styles.moods}>
                    {vaultMoods.map(({ mood, icon }) => (
                      <VaultGlassButton
                        key={mood}
                        accessibilityLabel={`Play ${mood} from The Vault`}
                        disabled={vaultPhase !== 'open' || Boolean(vaultLoadingMood)}
                        height={44}
                        onPress={() => void chooseVaultMood(mood)}
                        style={styles.moodItem}
                        contentStyle={styles.moodContent}>
                        {vaultLoadingMood === mood ? (
                          <ActivityIndicator color="#E7E0FF" size="small" />
                        ) : (
                          <>
                            <SymbolView name={icon} size={16} tintColor="#CDB7FF" weight="semibold" />
                            <Text style={styles.moodText}>{mood}</Text>
                          </>
                        )}
                      </VaultGlassButton>
                    ))}
                  </View>
                  <VaultGlassButton
                    accessibilityLabel="Close Vault moods"
                    disabled={vaultPhase !== 'open' || Boolean(vaultLoadingMood)}
                    height={44}
                    onPress={() => void transitionVault(false)}
                    style={styles.vaultCloseButton}
                    contentStyle={styles.moodContent}>
                    <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={15} tintColor="#E7E0FF" weight="semibold" />
                    <Text style={styles.moodText}>Close</Text>
                  </VaultGlassButton>
                </VaultGlassGroup>
              </Animated.View>
            ) : null}
          </Animated.View>

          <SectionHeader
            title="New songs, new you"
            subtitle="Looking for something fresh? Here's 5 random excellent tunes!"
          />

          <View style={styles.songList}>
            {loading ? (
              <SongListSkeleton shimmer={skeletonShimmer} />
            ) : (
              songs.map((song) => (
                <SongListRow
                  key={song.id}
                  song={song}
                  onPress={() => openSong(song)}
                  onMenuPress={() => openSongActions(song)}
                />
              ))
            )}
          </View>

          <SectionHeader title="Artists worth checking out" />
          <ScrollView
            horizontal
            alwaysBounceHorizontal
            bounces
            showsHorizontalScrollIndicator={false}
            style={styles.fullBleedCarousel}
            contentContainerStyle={styles.artistList}>
            {loading ? (
              <ArtistListSkeleton shimmer={skeletonShimmer} />
            ) : artists.map((artist) => (
              <Pressable
                key={artist.id}
                accessibilityRole="button"
                onPress={() => router.push(artistHref(artist.id))}
                onLongPress={() => openArtistActions(artist)}
                delayLongPress={350}
                style={({ pressed }) => [styles.artist, pressed && styles.artistPressed, pressed && !reduceMotion && styles.artistPressedScale]}>
                <View style={styles.artistHalo}>
                  <View style={styles.artistImageWrap}>
                    <Image
                      contentFit="cover"
                      source={artist.imageSmall ? { uri: artist.imageSmall } : defaultArtistImage}
                      style={StyleSheet.absoluteFill}
                    />
                    <CollectionPlayingOverlay sourceName={artist.name} spectrumSize={42} />
                  </View>
                </View>
                <Text numberOfLines={1} style={[styles.artistName, { color: colors.text }]}>{artist.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.playlistHeading}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Playlists curated just for </Text>
            <Text style={[styles.playlistHighlight, { color: colors.accent }]}>YOU</Text>
          </View>
          <ScrollView horizontal alwaysBounceHorizontal bounces showsHorizontalScrollIndicator={false} style={styles.fullBleedCarousel} contentContainerStyle={styles.playlistList}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open The Vault"
              disabled={vaultPhase === 'opening' || vaultPhase === 'closing' || Boolean(vaultLoadingMood)}
              onPress={openVaultFromPlaylist}
              style={({ pressed }) => [styles.playlistCard, pressed && !reduceMotion && styles.artistPressedScale]}>
              <View style={styles.playlistArtworkWrap}>
                <Image autoplay={!reduceMotion && !performanceMode} contentFit="cover" source={require('@/assets/images/onboarding/vault-banner.gif')} style={styles.playlistArtwork} />
                <VaultGlassSurface interactive radius={26} style={styles.vaultCardPlay}>
                  <SymbolView name="play.fill" size={25} tintColor="#F0E9FF" />
                </VaultGlassSurface>
              </View>
              <Text numberOfLines={1} style={[styles.playlistTitle, { color: colors.text }]}>The Vault</Text>
              <Text numberOfLines={1} style={[styles.playlistSubtitle, { color: colors.secondaryText }]}>Ready to experience magic</Text>
            </Pressable>
            {loading ? (
              <PlaylistListSkeleton shimmer={skeletonShimmer} />
            ) : playlists.map((playlist) => (
              <Pressable
                key={playlist.id}
                accessibilityRole="button"
                onPress={() => router.push(playlistHref(playlist.id, false, playlist.source, playlist.title))}
                onLongPress={() => openPlaylistActions(playlist)}
                delayLongPress={350}
                style={({ pressed }) => [styles.playlistCard, pressed && styles.artistPressed, pressed && !reduceMotion && styles.artistPressedScale]}>
                <PlaylistCover playlist={playlist} style={styles.playlistArtwork} />
                <Text numberOfLines={1} style={[styles.playlistTitle, { color: colors.text }]}>{playlist.title}</Text>
                <Text numberOfLines={1} style={[styles.playlistSubtitle, { color: colors.secondaryText }]}>{playlist.artists}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {loading ? (
            <FeatureSkeleton shimmer={skeletonShimmer} />
          ) : featuredArtist ? (
            <View style={styles.featureSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>This Month&apos;s Feature</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${featuredArtist.name}`}
                onPress={() => router.push(artistHref(featuredArtist.id))}
                onLongPress={() => openArtistActions(featuredArtist)}
                delayLongPress={350}
                style={({ pressed }) => [styles.featureCard, pressed && styles.artistPressed, pressed && !reduceMotion && styles.artistPressedScale]}>
                <View style={styles.featureImageWrap}>
                  <Image contentFit="cover" source={featuredArtist.image ? { uri: featuredArtist.image } : defaultArtistImage} style={StyleSheet.absoluteFill} />
                  <CollectionPlayingOverlay sourceName={featuredArtist.name} spectrumSize={50} />
                </View>
                <LinearGradient colors={['rgba(24,16,38,0.84)', 'rgba(82,31,126,0.68)']} style={styles.featureInfo}>
                  <Text numberOfLines={1} style={styles.featureName}>{featuredArtist.name}</Text>
                  <Text style={styles.featureFollowers}>{featuredArtist.followers} Followers</Text>
                  <View style={[styles.featureButton, styles.featureButtonVisual]}>
                    <Text style={styles.featureButtonText}>View Profile</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
          ) : null}
      </Reanimated.ScrollView>
      <MainHeaderOverlay compact={!personalizationOverride} title="Home" offset={headerScroll.offset} />
    </MainScreenBackground>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useAppSettings();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text> : null}
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
          style={[styles.skeletonSongRow, { backgroundColor: colors.elevated }]}>
          <SkeletonBlock shimmer={shimmer} style={styles.skeletonSongArtwork} />
          <View style={styles.skeletonSongCopy}>
            <SkeletonBlock shimmer={shimmer} style={[styles.skeletonLine, { width: `${68 - index * 4}%` }]} />
            <SkeletonBlock shimmer={shimmer} style={[styles.skeletonSmallLine, { width: `${40 + index * 3}%` }]} />
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
          <SkeletonBlock shimmer={shimmer} style={styles.skeletonPlaylistArtwork} />
          <SkeletonBlock
            shimmer={shimmer}
            style={[styles.skeletonPlaylistTitle, { width: index === 1 ? 92 : 108 }]}
          />
          <SkeletonBlock
            shimmer={shimmer}
            style={[styles.skeletonPlaylistSubtitle, { width: index === 2 ? 74 : 88 }]}
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
      <Text style={[styles.sectionTitle, styles.skeletonFeatureHeading, { color: colors.text }]}>
        This Month&apos;s Feature
      </Text>
      <View style={[styles.skeletonFeatureCard, { backgroundColor: colors.elevated }]}>
        <SkeletonBlock shimmer={shimmer} style={styles.skeletonFeatureImage} />
        <View style={styles.skeletonFeatureInfo}>
          <SkeletonBlock shimmer={shimmer} style={styles.skeletonFeatureName} />
          <SkeletonBlock shimmer={shimmer} style={styles.skeletonFeatureFollowers} />
          <SkeletonBlock shimmer={shimmer} style={styles.skeletonFeatureButton} />
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
      style={[styles.skeletonBlock, { backgroundColor: colors.surfaceStrong }, style]}>
      <Animated.View
        style={[
          styles.skeletonShimmer,
          { transform: [{ translateX }] },
        ]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(255,255,255,0)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0)', 'rgba(255,255,255,0.72)', 'rgba(255,255,255,0)']}
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
  screen: { flex: 1, backgroundColor: '#0E0D13' },
  scrollContent: { paddingHorizontal: 20 },
  vault: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#762DFF',
    shadowRadius: 64,
    shadowOffset: { width: 0, height: -28 },
  },
  vaultPrimary: { position: 'absolute', top: 16, left: 22, right: 22, alignItems: 'center', gap: 6 },
  vaultTitle: { color: '#E7E0FF', fontSize: 25, fontWeight: '500', letterSpacing: 1.1 },
  vaultDescription: { maxWidth: 250, color: 'rgba(231,224,255,0.78)', fontSize: 12, lineHeight: 16, textAlign: 'center' },
  vaultOpener: { position: 'absolute', top: 94, left: 0, right: 0, alignItems: 'center' },
  vaultPlayButton: { width: 144 },
  vaultMoodPanel: { position: 'absolute', top: 112, left: 12, right: 12 },
  vaultMoodGroup: { alignItems: 'center', gap: 12 },
  moods: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  moodItem: { width: '48%' },
  vaultCloseButton: { width: 104 },
  moodContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  moodText: { color: '#E7E0FF', fontSize: 14, fontWeight: '700' },
  sectionHeader: { marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: '#DCD6F7', fontSize: 22, lineHeight: 26, fontWeight: '700', letterSpacing: -0.45 },
  sectionSubtitle: { marginTop: 4, color: '#8A85A1', fontSize: 12, lineHeight: 16 },
  songList: { gap: 7 },
  fullBleedCarousel: { marginHorizontal: -20 },
  artistList: { gap: 12, paddingHorizontal: 20, paddingBottom: 18 },
  artist: { width: 98, alignItems: 'center', gap: 7 },
  artistPressed: { opacity: 0.82 },
  artistPressedScale: { transform: [{ scale: 0.96 }] },
  artistHalo: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(220,214,247,0.72)',
    backgroundColor: 'rgba(143,89,245,0.13)',
  },
  artistImageWrap: { width: 88, height: 88, overflow: 'hidden', borderRadius: 44 },
  artistName: { width: '92%', color: '#DCD6F7', fontSize: 13, textAlign: 'center' },
  playlistHeading: { marginTop: 7, marginBottom: 14, flexDirection: 'row', alignItems: 'baseline' },
  playlistHighlight: { color: '#8F59F5', fontSize: 22, lineHeight: 26, fontWeight: '800', letterSpacing: -0.45 },
  playlistList: { gap: 11, paddingHorizontal: 20 },
  playlistCard: { width: 128 },
  playlistArtworkWrap: { width: 128, height: 146 },
  playlistArtwork: { width: 128, height: 146, borderRadius: 17, backgroundColor: '#1F1D23', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(220,214,247,0.22)' },
  vaultCardPlay: { position: 'absolute', top: 45, left: 39, width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  playlistTitle: { marginTop: 8, color: '#DCD6F7', fontSize: 15, fontWeight: '700' },
  playlistSubtitle: { marginTop: 2, color: '#8A85A1', fontSize: 12 },
  featureSection: { marginTop: 32, gap: 14 },
  featureCard: { height: 178, overflow: 'hidden', flexDirection: 'row', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(220,214,247,0.22)', backgroundColor: '#19151F' },
  featureImageWrap: { width: '45%', height: '100%', overflow: 'hidden' },
  featureInfo: { flex: 1, justifyContent: 'center', paddingHorizontal: 17 },
  featureName: { color: '#F1ECFF', fontSize: 27, fontWeight: '800', letterSpacing: -0.7 },
  featureFollowers: { marginTop: 5, color: '#AAA1BB', fontSize: 14 },
  featureButton: { width: '100%', marginTop: 19 },
  featureButtonVisual: { height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(220,214,247,0.22)', backgroundColor: 'rgba(82,169,209,0.34)' },
  featureButtonText: { color: '#F5F0FF', fontSize: 14, fontWeight: '700' },
  skeletonBlock: { overflow: 'hidden' },
  skeletonShimmer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 160 },
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
  skeletonArtist: { width: 96, height: 96, borderRadius: 48 },
  skeletonArtistName: { height: 11, borderRadius: 6 },
  skeletonPlaylistArtwork: { width: 128, height: 146, borderRadius: 17 },
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
  skeletonFeatureInfo: { flex: 1, justifyContent: 'center', paddingHorizontal: 17 },
  skeletonFeatureName: { width: '82%', height: 24, borderRadius: 9 },
  skeletonFeatureFollowers: { width: '58%', height: 11, marginTop: 10, borderRadius: 6 },
  skeletonFeatureButton: { width: '100%', height: 42, marginTop: 22, borderRadius: 15 },
});
