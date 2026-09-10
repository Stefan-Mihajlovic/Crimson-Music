/* eslint-disable react-hooks/immutability */

import { Image } from 'expo-image';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  AnimatedStyle,
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { CrimsonSong } from '@/services/music';

const fallbackArtwork = require('@/assets/images/home/default-song.webp');
const swipeEasing = Easing.bezier(0.18, 0.76, 0.22, 1);
// Used when a caller does not provide its exact distance to the screen edge.
const defaultArtworkPageGap = 30;

type SongPage = CrimsonSong | null;

function useAdjacentSongs() {
  const { currentSong, playSong, queue, queueIndex, repeatMode, source, sourceId } = usePlayer();

  const previousIndex = queue.length > 1
    ? queueIndex > 0
      ? queueIndex - 1
      : repeatMode === 'all'
        ? queue.length - 1
        : -1
    : -1;
  const nextIndex = queue.length > 1
    ? queueIndex >= 0 && queueIndex < queue.length - 1
      ? queueIndex + 1
      : repeatMode === 'all'
        ? 0
        : -1
    : -1;
  const previousSong = previousIndex >= 0 ? queue[previousIndex] : null;
  const nextSong = nextIndex >= 0 ? queue[nextIndex] : null;

  const selectPrevious = useCallback(() => {
    if (previousSong) playSong(previousSong, queue, source, sourceId);
  }, [playSong, previousSong, queue, source, sourceId]);
  const selectNext = useCallback(() => {
    if (nextSong) playSong(nextSong, queue, source, sourceId);
  }, [nextSong, playSong, queue, source, sourceId]);

  return { currentSong, nextSong, previousSong, selectNext, selectPrevious };
}

function useSwipePager({
  enabled,
  nextSong,
  onNext,
  onPrevious,
  pageKey,
  pageWidth,
  previousSong,
}: {
  enabled: boolean;
  nextSong: SongPage;
  onNext: () => void;
  onPrevious: () => void;
  pageKey: string;
  pageWidth: number;
  previousSong: SongPage;
}) {
  const { reduceMotion } = useAppSettings();
  const offset = useSharedValue(0);

  useLayoutEffect(() => {
    cancelAnimation(offset);
    offset.value = 0;
  }, [offset, pageKey]);

  const finishPrevious = useCallback(() => {
    onPrevious();
  }, [onPrevious]);
  const finishNext = useCallback(() => {
    onNext();
  }, [onNext]);

  const gesture = useMemo(() => Gesture.Pan()
    .enabled(enabled && pageWidth > 0)
    .activeOffsetX([-9, 9])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      cancelAnimation(offset);
    })
    .onUpdate((event) => {
      const movingToPrevious = event.translationX > 0;
      const hasDestination = movingToPrevious ? Boolean(previousSong) : Boolean(nextSong);
      const limit = pageWidth * 0.995;
      const rawOffset = hasDestination ? event.translationX : event.translationX * 0.14;
      offset.value = Math.max(-limit, Math.min(limit, rawOffset));
    })
    .onEnd((event) => {
      const thresholdMet = Math.abs(event.translationX) > pageWidth * 0.2 || Math.abs(event.velocityX) > 620;
      const goingPrevious = event.translationX > 0;
      const canCommit = thresholdMet && (goingPrevious ? Boolean(previousSong) : Boolean(nextSong));

      if (!canCommit) {
        offset.value = withSpring(0, { damping: 22, stiffness: 245, mass: 0.8 });
        return;
      }

      const destination = goingPrevious ? pageWidth : -pageWidth;
      offset.value = withTiming(destination, {
        duration: reduceMotion ? 0 : 320,
        easing: swipeEasing,
      }, (finished) => {
        if (!finished) return;
        if (goingPrevious) scheduleOnRN(finishPrevious);
        else scheduleOnRN(finishNext);
      });
    })
    .onFinalize((_event, success) => {
      if (!success) offset.value = withSpring(0, { damping: 22, stiffness: 245 });
    }), [enabled, finishNext, finishPrevious, nextSong, offset, pageWidth, previousSong, reduceMotion]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -pageWidth + offset.value }],
  }));
  const previousStyle = useAnimatedStyle(() => {
    const progress = interpolate(offset.value, [0, pageWidth], [0, 1], Extrapolation.CLAMP);
    return { opacity: 0.78 + progress * 0.22, transform: [{ scale: 0.985 + progress * 0.015 }] };
  });
  const currentStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.abs(offset.value) / Math.max(1, pageWidth));
    return { opacity: 1 - progress * 0.08, transform: [{ scale: 1 - progress * 0.015 }] };
  });
  const nextStyle = useAnimatedStyle(() => {
    const progress = interpolate(offset.value, [-pageWidth, 0], [1, 0], Extrapolation.CLAMP);
    return { opacity: 0.78 + progress * 0.22, transform: [{ scale: 0.985 + progress * 0.015 }] };
  });

  return { currentStyle, gesture, nextStyle, previousStyle, trackStyle };
}

function artworkSource(song: SongPage, dataSaver: boolean) {
  if (!song) return fallbackArtwork;
  if (dataSaver && song.imageSmall) return { uri: song.imageSmall };
  if (song.image) return { uri: song.image };
  if (song.imageSmall) return { uri: song.imageSmall };
  return fallbackArtwork;
}

export function SwipeableArtwork({
  borderRadius = 28,
  enabled = true,
  pageGap = defaultArtworkPageGap,
  size,
}: {
  borderRadius?: number;
  enabled?: boolean;
  pageGap?: number;
  size: number;
}) {
  const { currentSong, nextSong, previousSong, selectNext, selectPrevious } = useAdjacentSongs();
  const pageWidth = size + pageGap;
  const pager = useSwipePager({
    enabled,
    nextSong,
    onNext: selectNext,
    onPrevious: selectPrevious,
    pageKey: currentSong?.id || '',
    pageWidth,
    previousSong,
  });

  if (!currentSong) return null;

  return (
    <View style={[styles.artworkViewport, { width: size, height: size }]}>
      <GestureDetector gesture={pager.gesture}>
        <Animated.View style={[styles.track, { width: pageWidth * 3 }, pager.trackStyle]}>
          <ArtworkPage animatedStyle={pager.previousStyle} borderRadius={borderRadius} pageWidth={pageWidth} size={size} song={previousSong} />
          <ArtworkPage animatedStyle={pager.currentStyle} borderRadius={borderRadius} pageWidth={pageWidth} size={size} song={currentSong} />
          <ArtworkPage animatedStyle={pager.nextStyle} borderRadius={borderRadius} pageWidth={pageWidth} size={size} song={nextSong} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function ArtworkPage({
  animatedStyle,
  borderRadius,
  pageWidth,
  size,
  song,
}: {
  animatedStyle: AnimatedStyle<ViewStyle>;
  borderRadius: number;
  pageWidth: number;
  size: number;
  song: SongPage;
}) {
  const { dataSaver } = useAppSettings();
  return (
    <View style={[styles.artworkPage, { width: pageWidth, height: size }]}>
      <Animated.View style={[styles.artworkCard, { width: size, height: size, borderRadius }, animatedStyle]}>
        {song ? (
          <Image
            contentFit="cover"
            recyclingKey={song.id}
            source={artworkSource(song, dataSaver)}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

export function SwipeableSongCopy({ enabled = true, leadingInset = 0 }: { enabled?: boolean; leadingInset?: number }) {
  const { colors } = useAppSettings();
  const { currentSong, nextSong, previousSong, selectNext, selectPrevious } = useAdjacentSongs();
  const [width, setWidth] = useState(0);
  const pager = useSwipePager({
    enabled,
    nextSong,
    onNext: selectNext,
    onPrevious: selectPrevious,
    pageKey: currentSong?.id || '',
    pageWidth: width,
    previousSong,
  });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== width) setWidth(nextWidth);
  }, [width]);

  if (!currentSong) return null;

  return (
    <View onLayout={onLayout} style={styles.copyViewport}>
      {width > 0 ? (
        <GestureDetector gesture={pager.gesture}>
          <Animated.View style={[styles.track, { width: width * 3 }, pager.trackStyle]}>
            <CopyPage animatedStyle={pager.previousStyle} colors={colors} leadingInset={leadingInset} song={previousSong} width={width} />
            <CopyPage animatedStyle={pager.currentStyle} colors={colors} leadingInset={leadingInset} song={currentSong} width={width} />
            <CopyPage animatedStyle={pager.nextStyle} colors={colors} leadingInset={leadingInset} song={nextSong} width={width} />
          </Animated.View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

function CopyPage({ animatedStyle, colors, leadingInset, song, width }: {
  animatedStyle: AnimatedStyle<ViewStyle>;
  colors: { secondaryText: string; text: string };
  leadingInset: number;
  song: SongPage;
  width: number;
}) {
  return (
    <Animated.View style={[styles.copyPage, { paddingLeft: leadingInset, width }, animatedStyle]}>
      {song ? (
        <>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{song.title}</Text>
          <Text numberOfLines={1} style={[styles.artist, { color: colors.secondaryText }]}>{song.creator}</Text>
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  artworkViewport: { overflow: 'visible' },
  track: { height: '100%', flexDirection: 'row' },
  artworkPage: { flexShrink: 0 },
  artworkCard: { overflow: 'hidden', backgroundColor: '#211C28' },
  copyViewport: { flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' },
  copyPage: { height: '100%', justifyContent: 'center', paddingHorizontal: 2 },
  title: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  artist: { marginTop: 2, fontSize: 12 },
});
