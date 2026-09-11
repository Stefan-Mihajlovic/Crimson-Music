import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from '@/components/app-symbol';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadFailure from '@/components/load-failure';
import DetailSongRow from '@/components/detail-song-row';
import BouncyPressable from '@/components/bouncy-pressable';
import CollectionHeaderPlayButton, {
  useCollectionHeaderPlaybackVisibility,
} from '@/components/collection-header-play-button';
import PlaylistCover from '@/components/playlist-cover';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref, useDetailRoutes } from '@/services/action-sheet';
import {
  CategoryDetail,
  CrimsonEvent,
  loadCategoryDetail,
} from '@/services/music';

const fallbackArtwork = require('@/assets/images/home/default-song.webp');

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { eventHref, playlistHref } = useDetailRoutes();
  const insets = useSafeAreaInsets();
  const { playSong } = usePlayer();
  const { colors, dataSaver, reduceMotion } = useAppSettings();
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const collectionPlayback = useCollectionPlayback(
    detail?.songs ?? [],
    detail?.category.name ?? '',
  );
  const headerPlayback = useCollectionHeaderPlaybackVisibility(
    Boolean(detail?.songs.length && detail.category.id !== 'events'),
    insets.top,
  );
  const renderHeaderPlayback = useCallback(
    () => (
      <CollectionHeaderPlayButton
        collectionName={detail?.category.name ?? ''}
        songs={detail?.songs ?? []}
      />
    ),
    [detail?.category.name, detail?.songs],
  );
  const screenOptions = useMemo(
    () => ({
      title: detail?.category.name ?? '',
      headerRight: headerPlayback.visible ? renderHeaderPlayback : undefined,
    }),
    [detail?.category.name, headerPlayback.visible, renderHeaderPlayback],
  );
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        setLoadError(false);
        setDetail(null);
      }
    });
    loadCategoryDetail(String(id))
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

  if (!detail) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        {loadError ? (
          <LoadFailure
            title="Category unavailable"
            onRetry={() => setRetry((value) => value + 1)}
          />
        ) : (
          <ActivityIndicator color={colors.accent} size="large" />
        )}
      </View>
    );
  }

  const { category, events, playlists, songs } = detail;
  const isEventCategory = category.id === 'events';
  const openSongActions = (song: CategoryDetail['songs'][number]) =>
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={screenOptions} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        onScroll={headerPlayback.onScroll}
        scrollsToTop={false}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {!isEventCategory ? (
          <View style={[styles.hero, { backgroundColor: category.color }]}>
            {category.localImage || category.image ? (
              <Image
                cachePolicy="memory-disk"
                source={
                  category.localImage || {
                    uri: dataSaver
                      ? category.imageSmall || category.image
                      : category.image,
                  }
                }
                contentFit="cover"
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: `${category.color}55` },
              ]}
            />
            <LinearGradient
              colors={['transparent', 'rgba(14,13,19,0.58)', colors.background]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.name}>{category.name}</Text>
              <Text style={styles.metadata}>
                {isEventCategory
                  ? `${events.length} active Audius events`
                  : `${songs.length} songs · ${playlists.length} playlists`}
              </Text>
              {!isEventCategory ? (
                <BouncyPressable
                  accessibilityLabel={
                    collectionPlayback.playing
                      ? `Pause ${category.name}`
                      : `Play ${category.name}`
                  }
                  disabled={!songs.length || collectionPlayback.loading}
                  onPress={collectionPlayback.toggleCollectionPlayback}
                  contentStyle={styles.playButtonContent}
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
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.body}>
          {isEventCategory ? (
            <>
              <Text style={[styles.heading, styles.eventsHeading, { color: colors.text }]}>
                Active events & contests
              </Text>
              <View style={styles.eventList}>
                {!events.length ? (
                  <Text style={{ color: colors.secondaryText }}>
                    No active contests right now. Check back soon.
                  </Text>
                ) : null}
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onPress={() => router.push(eventHref(event.id))}
                  />
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.heading, { color: colors.text }]}>
                Featured Songs
              </Text>
              {songs.length ? (
                songs.map((song) => (
                  <DetailSongRow
                    key={song.id}
                    song={song}
                    onPress={() => playSong(song, songs, category.name)}
                    onLongPress={() => openSongActions(song)}
                  />
                ))
              ) : (
                <Text style={[styles.empty, { color: colors.secondaryText }]}>
                  No songs in this category yet.
                </Text>
              )}
            </>
          )}

          {playlists.length ? (
            <>
              <Text style={[styles.heading, { color: colors.text }]}>
                Featured Playlists
              </Text>
              <ScrollView
                horizontal
                style={styles.fullBleedCarousel}
                contentContainerStyle={styles.cards}
                showsHorizontalScrollIndicator={false}
              >
                {playlists.map((playlist) => (
                  <Pressable
                    key={playlist.id}
                    delayLongPress={350}
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
                    style={({ pressed }) => [
                      styles.card,
                      pressed && styles.pressed,
                      pressed && !reduceMotion && styles.pressedScale,
                    ]}
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
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.cardSubtitle,
                        { color: colors.secondaryText },
                      ]}
                    >
                      {playlist.artists}
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

function EventCard({
  event,
  onPress,
}: {
  event: CrimsonEvent;
  onPress: () => void;
}) {
  const { colors } = useAppSettings();
  const deadline = event.endDate
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(event.endDate))
    : 'Open now';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.eventCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={event.image ? { uri: event.image } : fallbackArtwork}
        contentFit="cover"
        style={styles.eventImage}
      />
      <LinearGradient
        colors={['transparent', 'rgba(9,7,13,0.92)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.eventCopy}>
        <Text numberOfLines={2} style={styles.eventTitle}>
          {event.title}
        </Text>
        <Text numberOfLines={1} style={styles.eventMeta}>
          {event.hostName} · Ends {deadline}
        </Text>
        <Text style={styles.eventEntries}>
          {event.entryCount} {event.entryCount === 1 ? 'entry' : 'entries'}
        </Text>
      </View>
    </Pressable>
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
  hero: { height: 390, justifyContent: 'flex-end' },
  heroCopy: { paddingHorizontal: 22, paddingBottom: 22 },
  name: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.3,
  },
  metadata: { marginTop: 5, color: '#C8C0D1', fontSize: 14 },
  playButton: {
    marginTop: 18,
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
  body: { paddingHorizontal: 12 },
  heading: {
    marginTop: 27,
    marginBottom: 9,
    paddingHorizontal: 10,
    color: '#F1ECFF',
    fontSize: 23,
    fontWeight: '800',
  },
  empty: {
    paddingHorizontal: 10,
    paddingVertical: 24,
    color: '#918A9D',
    fontSize: 15,
  },
  fullBleedCarousel: { marginHorizontal: -12 },
  cards: { gap: 13, paddingHorizontal: 22, paddingBottom: 14 },
  eventsHeading: { marginTop: 16, marginBottom: 14 },
  eventList: { gap: 12, paddingHorizontal: 10 },
  eventCard: {
    height: 190,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  eventImage: { position: 'absolute', inset: 0, backgroundColor: '#211C28' },
  eventCopy: { padding: 16 },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  eventMeta: {
    marginTop: 5,
    color: '#D5CEDC',
    fontSize: 13,
    fontWeight: '600',
  },
  eventEntries: {
    marginTop: 8,
    color: '#CDAEFF',
    fontSize: 12,
    fontWeight: '800',
  },
  card: { width: 142 },
  cardImage: {
    width: 142,
    height: 142,
    borderRadius: 18,
    backgroundColor: '#211C28',
  },
  cardTitle: {
    marginTop: 8,
    color: '#F1ECFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: { marginTop: 2, color: '#918A9D', fontSize: 12 },
  pressed: { opacity: 0.76 },
  pressedScale: { transform: [{ scale: 0.98 }] },
});
