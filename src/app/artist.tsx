import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DetailSongRow from '@/components/detail-song-row';
import BouncyPressable from '@/components/bouncy-pressable';
import CollectionHeaderPlayButton, {
  useCollectionHeaderPlaybackVisibility,
} from '@/components/collection-header-play-button';
import PlaylistCover from '@/components/playlist-cover';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { useAuth } from '@/providers/auth-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref, useDetailRoutes } from '@/services/action-sheet';
import {
  ArtistDetail,
  getUserCollectionState,
  toggleUserCollectionItem,
} from '@/services/music';

import LoadFailure from '@/components/load-failure';
import { ArtistCatalog, loadArtistCatalog } from '@/services/artist-catalog';
import { requestLibraryRefresh } from '@/services/navigation-events';

const fallbackArtist = require('@/assets/images/home/default-artist.webp');

type ArtistSocialLink = {
  icon: 'arrow-up-right-from-square' | 'instagram' | 'tiktok' | 'x-twitter';
  label: string;
  url: string;
};

function websiteUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { artistHref, artistTracksHref, playlistHref } = useDetailRoutes();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { playSong } = usePlayer();
  const { colors, dataSaver } = useAppSettings();
  const [detail, setDetail] = useState<ArtistCatalog | null>(null);
  const [following, setFollowing] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const followLock = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const collectionPlayback = useCollectionPlayback(
    detail?.songs ?? [],
    detail?.artist.name ?? '',
  );
  const headerPlayback = useCollectionHeaderPlaybackVisibility(
    Boolean(detail?.songs.length),
    insets.top,
  );
  const renderHeaderPlayback = useCallback(
    () => (
      <CollectionHeaderPlayButton
        collectionName={detail?.artist.name ?? ''}
        songs={detail?.songs ?? []}
      />
    ),
    [detail?.artist.name, detail?.songs],
  );
  const screenOptions = useMemo(
    () => ({
      title: detail?.artist.name ?? '',
      headerRight: headerPlayback.visible ? renderHeaderPlayback : undefined,
    }),
    [detail?.artist.name, headerPlayback.visible, renderHeaderPlayback],
  );

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        setLoadError(false);
        setDetail(null);
      }
    });
    loadArtistCatalog(String(id))
      .then((value) => {
        if (active) setDetail(value);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);

  useEffect(() => {
    let active = true;
    if (user?.uid && id)
      getUserCollectionState(user.uid, 'FollowedArtists', String(id))
        .then((value) => {
          if (active) setFollowing(value);
        })
        .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [id, user?.uid]);

  const openSongActions = (song: ArtistDetail['songs'][number]) =>
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

  if (!detail)
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        {loadError ? (
          <LoadFailure
            title="Artist unavailable"
            onRetry={() => setRetry((value) => value + 1)}
          />
        ) : (
          <ActivityIndicator color={colors.accent} size="large" />
        )}
      </View>
    );
  const { artist, songs, relatedArtists, appearsOn, hasMoreTracks } = detail;
  const heroArtwork = dataSaver
    ? artist.imageSmall || artist.image
    : artist.image;
  const socialLinks: ArtistSocialLink[] = [
    artist.twitterHandle && {
      icon: 'x-twitter',
      label: `@${artist.twitterHandle}`,
      url: `https://x.com/${encodeURIComponent(artist.twitterHandle)}`,
    },
    artist.instagramHandle && {
      icon: 'instagram',
      label: `@${artist.instagramHandle}`,
      url: `https://www.instagram.com/${encodeURIComponent(artist.instagramHandle)}`,
    },
    artist.tiktokHandle && {
      icon: 'tiktok',
      label: `@${artist.tiktokHandle}`,
      url: `https://www.tiktok.com/@${encodeURIComponent(artist.tiktokHandle)}`,
    },
    artist.website && {
      icon: 'arrow-up-right-from-square',
      label: 'Website',
      url: websiteUrl(artist.website),
    },
  ].filter((link): link is ArtistSocialLink => Boolean(link));
  const aboutCopy =
    artist.description ||
    `${artist.name} has not added a bio yet. Press play and get to know the artist through the music.`;

  const toggleFollow = async () => {
    if (!user?.uid || followLock.current) return;
    followLock.current = true;
    setFollowPending(true);
    try {
      setFollowing(
        await toggleUserCollectionItem(
          user.uid,
          'FollowedArtists',
          artist.id,
          artist,
        ),
      );
      requestLibraryRefresh();
    } catch {
      Alert.alert('Could not update artist', 'Please try again.');
    } finally {
      followLock.current = false;
      setFollowPending(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={screenOptions} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        onScroll={headerPlayback.onScroll}
        scrollsToTop={false}
        scrollEventThrottle={16}
      >
        <View style={styles.hero}>
          <Image
            cachePolicy="memory-disk"
            source={heroArtwork ? { uri: heroArtwork } : fallbackArtist}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['transparent', 'rgba(14,13,19,0.58)', colors.background]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroCopy}>
            <Text style={styles.name}>{artist.name}</Text>
            <View style={styles.metadataRow}>
              <Text style={styles.metadata}>
                <Text style={styles.metadataNumber}>
                  {artist.trackCount.toLocaleString()}
                </Text>{' '}
                {artist.trackCount === 1 ? 'Track' : 'Tracks'}
              </Text>
              <Text style={styles.metadata}>
                <Text style={styles.metadataNumber}>{artist.followers}</Text>{' '}
                Followers
              </Text>
            </View>
            <View style={styles.actions}>
              <BouncyPressable
                accessibilityRole="button"
                accessibilityLabel={
                  following
                    ? `Unfollow ${artist.name}`
                    : `Follow ${artist.name}`
                }
                disabled={followPending}
                onPress={() => void toggleFollow()}
                contentStyle={styles.actionButtonContent}
                pressedScale={0.9}
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: colors.controlSurface,
                    borderColor: following ? colors.accent : colors.border,
                  },
                ]}
              >
                <SymbolView
                  name={following ? 'checkmark' : 'plus'}
                  size={17}
                  tintColor={following ? colors.accent : colors.text}
                  weight="bold"
                />
                <Text
                  style={[
                    styles.buttonText,
                    { color: following ? colors.accent : colors.text },
                  ]}
                >
                  {followPending
                    ? 'Saving…'
                    : following
                      ? 'Following'
                      : 'Follow'}
                </Text>
              </BouncyPressable>
              <BouncyPressable
                accessibilityLabel={
                  collectionPlayback.playing
                    ? `Pause ${artist.name}`
                    : `Play ${artist.name}`
                }
                disabled={!songs.length || collectionPlayback.loading}
                onPress={collectionPlayback.toggleCollectionPlayback}
                contentStyle={styles.actionButtonContent}
                pressedScale={0.9}
                style={[
                  styles.playButton,
                  { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
                ]}
              >
                {collectionPlayback.loading ? (
                  <ActivityIndicator color="#17121D" size="small" />
                ) : (
                  <SymbolView
                    name={
                      collectionPlayback.playing ? 'pause.fill' : 'play.fill'
                    }
                    size={18}
                    tintColor="#17121D"
                    weight="bold"
                  />
                )}
                <Text style={styles.playText}>
                  {collectionPlayback.loading
                    ? 'Loading'
                    : collectionPlayback.playing
                      ? 'Pause'
                      : 'Play'}
                </Text>
              </BouncyPressable>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {socialLinks.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.socialScroller}
              contentContainerStyle={styles.socialLinks}
            >
              {socialLinks.map((social) => (
                <Pressable
                  key={social.url}
                  accessibilityLabel={`Open ${social.label}`}
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(social.url)}
                  style={({ pressed }) => [
                    styles.socialLink,
                    {
                      backgroundColor: colors.controlSurface,
                      borderColor: colors.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <FontAwesome6
                    color={colors.accent}
                    name={social.icon}
                    size={16}
                    style={styles.socialIcon}
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.socialLabel, { color: colors.text }]}
                  >
                    {social.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <Text style={[styles.heading, { color: colors.text }]}>
            Latest Release
          </Text>
          {detail.latestRelease ? (
            <DetailSongRow
              song={detail.latestRelease}
              onPress={() =>
                detail.latestRelease &&
                playSong(
                  detail.latestRelease,
                  [
                    detail.latestRelease,
                    ...songs.filter(
                      (song) => song.id !== detail.latestRelease?.id,
                    ),
                  ],
                  artist.name,
                )
              }
              onLongPress={() =>
                detail.latestRelease && openSongActions(detail.latestRelease)
              }
            />
          ) : (
            <Text style={[styles.empty, { color: colors.secondaryText }]}>
              No releases yet.
            </Text>
          )}
          <View style={styles.trackHeading}>
            <Text
              style={[
                styles.heading,
                styles.trackHeadingTitle,
                { color: colors.text },
              ]}
            >
              Popular tracks
            </Text>
            {hasMoreTracks ? (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push(artistTracksHref(artist.id, artist.name))
                }
                accessibilityLabel={`View all tracks by ${artist.name}`}
                style={({ pressed }) => [styles.viewMoreButton, pressed && styles.pressed]}
              >
                <Text style={[styles.viewMoreText, { color: colors.accent }]}>
                  View all
                </Text>
                <SymbolView
                  name="chevron.right"
                  size={11}
                  tintColor={colors.secondaryText}
                  weight="semibold"
                />
              </Pressable>
            ) : null}
          </View>
          {songs.map((song) => (
            <DetailSongRow
              key={song.id}
              song={song}
              onPress={() => playSong(song, songs, artist.name)}
              onLongPress={() => openSongActions(song)}
            />
          ))}

          {relatedArtists.length ? (
            <>
              <Text style={[styles.heading, { color: colors.text }]}>
                Related Artists
              </Text>
              <ScrollView
                horizontal
                alwaysBounceHorizontal
                bounces
                showsHorizontalScrollIndicator={false}
                style={styles.relatedScroller}
                contentContainerStyle={styles.relatedArtists}
              >
                {relatedArtists.map((relatedArtist) => (
                  <Pressable
                    key={relatedArtist.id}
                    accessibilityLabel={`Open ${relatedArtist.name}`}
                    accessibilityRole="button"
                    onPress={() => router.push(artistHref(relatedArtist.id))}
                    style={({ pressed }) => [
                      styles.relatedArtist,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.relatedHalo,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.accentSoft,
                        },
                      ]}
                    >
                      <Image
                        source={
                          relatedArtist.imageSmall
                            ? { uri: relatedArtist.imageSmall }
                            : fallbackArtist
                        }
                        contentFit="cover"
                        style={styles.relatedImage}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.relatedName, { color: colors.text }]}
                    >
                      {relatedArtist.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={[styles.heading, { color: colors.text }]}>
            About {artist.name}
          </Text>
          <View
            style={[
              styles.aboutCard,
              {
                backgroundColor: colors.controlSurface,
                borderColor: colors.border,
              },
            ]}
          >
            {artist.aboutImage && !dataSaver ? (
              <>
                <Image
                  source={{ uri: artist.aboutImage }}
                  contentFit="cover"
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={['rgba(9,7,12,0.42)', 'rgba(9,7,12,0.92)']}
                  style={StyleSheet.absoluteFill}
                />
              </>
            ) : null}
            <Text
              style={[
                styles.aboutText,
                (!artist.aboutImage || dataSaver) && {
                  color: colors.secondaryText,
                },
              ]}
            >
              {aboutCopy}
            </Text>
          </View>

          {appearsOn.length ? (
            <>
              <Text style={[styles.heading, { color: colors.text }]}>
                Albums & Playlists
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.relatedScroller}
                contentContainerStyle={styles.cards}
              >
                {appearsOn.map((playlist) => (
                  <Pressable
                    key={playlist.id}
                    delayLongPress={350}
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
                    style={styles.card}
                  >
                    <PlaylistCover
                      playlist={playlist}
                      style={styles.cardImage}
                    />
                    <Text
                      numberOfLines={1}
                      style={[styles.cardTitle, { color: colors.text }]}
                    >
                      {playlist.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E0D13' },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E0D13',
  },
  hero: { height: 390, justifyContent: 'flex-end', backgroundColor: '#201A29' },
  heroCopy: { paddingHorizontal: 22, paddingBottom: 22 },
  name: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.3,
  },
  metadataRow: {
    marginTop: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
  },
  metadata: { color: '#C0B8CA', fontSize: 14 },
  metadataNumber: { color: '#FFFFFF', fontWeight: '800' },
  actions: { marginTop: 18, flexDirection: 'row', gap: 10 },
  actionButtonContent: { flexDirection: 'row', gap: 7 },
  secondaryButton: {
    height: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  playButton: {
    height: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonText: { color: '#F4EEFF', fontSize: 15, fontWeight: '700' },
  playText: { color: '#17121D', fontSize: 15, fontWeight: '800' },
  body: { paddingHorizontal: 12 },
  heading: {
    marginTop: 27,
    marginBottom: 9,
    paddingHorizontal: 10,
    color: '#F1ECFF',
    fontSize: 23,
    fontWeight: '800',
  },
  socialScroller: { marginTop: -4, marginHorizontal: -12 },
  socialLinks: { gap: 7, paddingHorizontal: 22, paddingBottom: 2 },
  socialLink: {
    maxWidth: 220,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  socialIcon: { width: 17, textAlign: 'center' },
  socialLabel: { flexShrink: 1, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  trackHeading: {
    marginTop: 27,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackHeadingTitle: {
    flex: 1,
    marginTop: 0,
    marginBottom: 9,
    paddingHorizontal: 0,
  },
  viewMoreButton: {
    minHeight: 44,
    marginTop: -9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 12,
  },
  viewMoreText: { fontSize: 13, fontWeight: '600' },
  empty: { paddingHorizontal: 10, color: '#918A9D' },
  relatedScroller: { marginHorizontal: -12 },
  relatedArtists: { gap: 12, paddingHorizontal: 22, paddingBottom: 8 },
  relatedArtist: { width: 142, alignItems: 'center', gap: 7 },
  relatedHalo: {
    width: 142,
    height: 142,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 71,
    borderWidth: 2,
  },
  relatedImage: {
    width: 134,
    height: 134,
    borderRadius: 67,
    backgroundColor: '#211C28',
  },
  relatedName: { width: '92%', fontSize: 13, textAlign: 'center' },
  aboutCard: {
    minHeight: 176,
    marginHorizontal: 10,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 18,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  aboutText: {
    color: '#F4F0F8',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  cards: { gap: 13, paddingHorizontal: 22, paddingBottom: 14 },
  card: { width: 142 },
  cardImage: {
    width: 142,
    height: 142,
    borderRadius: 17,
    backgroundColor: '#211C28',
  },
  cardTitle: {
    marginTop: 7,
    color: '#F1ECFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
