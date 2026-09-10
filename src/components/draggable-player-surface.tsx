/* eslint-disable react-hooks/immutability */

import { GlassView } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  AnimatedStyle,
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { getPlayerArtworkLayout, PlayerContent } from '@/app/player';
import { BOTTOM_BAR_HORIZONTAL_INSET, MINI_PLAYER_HEIGHT } from '@/components/player-layout';
import { SwipeableArtwork, SwipeableSongCopy } from '@/components/song-swipe-pager';
import BouncyPressable from '@/components/bouncy-pressable';
import PlayerArtworkBackground from '@/components/player-artwork-background';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';

const fallbackArtwork = require('@/assets/images/home/default-song.webp');
const miniPlayerHorizontalInset = BOTTOM_BAR_HORIZONTAL_INSET;

export default function DraggablePlayerSurface({
  collapsedTop,
  expanded,
  height,
  onBeginExpand,
  onCollapse,
  onExpand,
  position,
}: {
  collapsedTop: number;
  expanded: boolean;
  height: number;
  onBeginExpand: () => void;
  onCollapse: (velocity?: number) => void;
  onExpand: (velocity?: number) => void;
  position: SharedValue<number>;
}) {
  const { currentSong } = usePlayer();
  const { dataSaver, reduceMotion } = useAppSettings();
  const [artworkLoaded, setArtworkLoaded] = useState(0);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeCollapsedTop = Math.max(1, collapsedTop);
  const dragStartPosition = useSharedValue(expanded ? 0 : collapsedTop);
  const gestureActive = useSharedValue(false);
  const entranceProgress = useSharedValue(currentSong ? 1 : 0);

  useEffect(() => {
    cancelAnimation(entranceProgress);
    if (!currentSong) {
      entranceProgress.value = 0;
      return;
    }
    entranceProgress.value = reduceMotion
      ? 1
      : withTiming(1, {
        duration: 360,
        easing: Easing.out(Easing.cubic),
      });
  }, [currentSong, entranceProgress, reduceMotion]);

  const gesture = useMemo(() => Gesture.Pan()
    .activeOffsetY([-4, 4])
    .failOffsetX([-12, 12])
    .onStart(() => {
      cancelAnimation(position);
      gestureActive.value = true;
      dragStartPosition.value = position.value;
      scheduleOnRN(onBeginExpand);
    })
    .onUpdate((event) => {
      position.value = Math.max(0, Math.min(safeCollapsedTop, dragStartPosition.value + event.translationY));
    })
    .onEnd((event) => {
      gestureActive.value = false;
      const currentPosition = Math.max(0, Math.min(safeCollapsedTop, position.value));
      const projectedPosition = currentPosition + event.velocityY * 0.12;
      if (projectedPosition > safeCollapsedTop * 0.5) scheduleOnRN(onCollapse, event.velocityY);
      else scheduleOnRN(onExpand, event.velocityY);
    })
    .onFinalize((_, success) => {
      // A tap also finalizes a Pan gesture, but it must remain a tap. Only
      // settle here when an already-active drag was actually cancelled.
      if (success || !gestureActive.value) return;
      gestureActive.value = false;
      if (position.value > safeCollapsedTop * 0.5) scheduleOnRN(onCollapse, 0);
      else scheduleOnRN(onExpand, 0);
    }), [dragStartPosition, gestureActive, onBeginExpand, onCollapse, onExpand, position, safeCollapsedTop]);

  // UIKit does not expose the physical display radius to apps. The top safe
  // area tracks the rounded-display generations closely, while continuous
  // corners reproduce the same superellipse curve used by the device bezel.
  const deviceCornerRadius = insets.top > 24
    ? Math.max(36, Math.min(56, insets.top - 6))
    : 0;
  const fullArtwork = getPlayerArtworkLayout(width, height, insets.top, insets.bottom);
  const miniArtworkSize = 34;
  const fullArtworkRadius = 28;
  const miniArtworkRadius = 8;
  const miniArtworkX = miniPlayerHorizontalInset + 14;
  const miniArtworkY = (MINI_PLAYER_HEIGHT - miniArtworkSize) / 2;
  const collapsedScaleX = Math.max(0.01, (width - miniPlayerHorizontalInset * 2) / width);
  const collapsedScaleY = Math.max(0.01, MINI_PLAYER_HEIGHT / height);
  // Keep the native GlassView fully opaque while it mounts. Animating an
  // ancestor from opacity 0 can prevent iOS from establishing glass compositing.
  const surfaceAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: position.value + interpolate(
        entranceProgress.value,
        [0, 1],
        [18, 0],
        Extrapolation.CLAMP,
      ),
    }],
  }));
  const playerClipAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(position.value, [0, safeCollapsedTop], [1, collapsedScaleX], Extrapolation.CLAMP) },
      { scaleY: interpolate(position.value, [0, safeCollapsedTop], [1, collapsedScaleY], Extrapolation.CLAMP) },
    ],
  }));
  const fullAnimatedStyle = useAnimatedStyle(() => {
    // Once the body is fully transparent there is no reason to keep growing
    // the inverse scale toward the very small mini-player height.
    const visiblePosition = Math.min(position.value, safeCollapsedTop * 0.92);
    const scaleX = interpolate(visiblePosition, [0, safeCollapsedTop], [1, collapsedScaleX], Extrapolation.CLAMP);
    const scaleY = interpolate(visiblePosition, [0, safeCollapsedTop], [1, collapsedScaleY], Extrapolation.CLAMP);
    return { transform: [{ scaleX: 1 / scaleX }, { scaleY: 1 / scaleY }] };
  });
  const colorLayerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(position.value, [0, safeCollapsedTop * 0.955, safeCollapsedTop], [1, 1, 0], Extrapolation.CLAMP),
  }));
  const bodyAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(position.value, [0, safeCollapsedTop * 0.58, safeCollapsedTop * 0.92], [1, 0.58, 0], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(position.value, [0, safeCollapsedTop * 0.88], [0, 74], Extrapolation.CLAMP),
    }],
  }));
  const topBarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(position.value, [0, safeCollapsedTop * 0.14, safeCollapsedTop * 0.44], [1, 0.2, 0], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(position.value, [0, safeCollapsedTop * 0.44], [0, -28], Extrapolation.CLAMP),
    }],
  }));
  const artworkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(position.value, [0, safeCollapsedTop], [0, miniArtworkX - fullArtwork.x], Extrapolation.CLAMP) },
      { translateY: interpolate(position.value, [0, safeCollapsedTop], [0, miniArtworkY - fullArtwork.y], Extrapolation.CLAMP) },
      { scale: interpolate(position.value, [0, safeCollapsedTop], [1, miniArtworkSize / fullArtwork.size], Extrapolation.CLAMP) },
    ],
  }));
  const artworkClipAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(position.value, [0, safeCollapsedTop], [1, miniArtworkSize / fullArtwork.size], Extrapolation.CLAMP);
    const displayedRadius = interpolate(position.value, [0, safeCollapsedTop], [fullArtworkRadius, miniArtworkRadius], Extrapolation.CLAMP);
    // The clip is inside the scaled layer, so compensate to keep its visible
    // radius changing smoothly in screen space.
    return { borderRadius: displayedRadius / scale };
  });
  const morphArtworkVisibilityStyle = useAnimatedStyle(() => ({
    // Do not cross-fade two differently sized covers while the surface is
    // still settling. At the swap point both layers have identical geometry.
    opacity: position.value <= 0.5 ? 0 : 1,
  }));
  const pagerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: position.value <= 0.5 ? 1 : 0,
  }));
  const compactAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(position.value, [safeCollapsedTop * 0.955, safeCollapsedTop], [0, 1], Extrapolation.CLAMP),
    transform: [{
      scaleX: interpolate(
        position.value,
        [0, safeCollapsedTop],
        [1 / collapsedScaleX, 1],
        Extrapolation.CLAMP,
      ),
    }],
  }));

  if (!currentSong) return null;

  const playerArtworkSource = currentSong.image || currentSong.imageSmall;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        pointerEvents={expanded ? 'auto' : 'box-none'}
        style={[styles.surface, { height }, surfaceAnimatedStyle]}>
        <Animated.View
          pointerEvents={expanded ? 'auto' : 'none'}
          style={[
            styles.playerClip,
            { height, borderRadius: deviceCornerRadius },
            playerClipAnimatedStyle,
          ]}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.colorLayer,
              colorLayerAnimatedStyle,
              {
                height,
              },
            ]}>
            <PlayerArtworkBackground active={expanded} artworkLoaded={artworkLoaded} song={currentSong} />
          </Animated.View>

          <Animated.View style={[styles.full, { height }, fullAnimatedStyle]}>
            {expanded ? (
              <PlayerContent
                artworkHidden
                bodyAnimatedStyle={bodyAnimatedStyle}
                onClose={() => onCollapse()}
                topBarAnimatedStyle={topBarAnimatedStyle}
              />
            ) : null}
          </Animated.View>
        </Animated.View>

        <Animated.View
          pointerEvents={expanded ? 'auto' : 'none'}
          style={[
            styles.morphArtwork,
            {
              left: fullArtwork.x,
              top: fullArtwork.y,
              width: fullArtwork.size,
              height: fullArtwork.size,
              transformOrigin: 'top left',
            },
            artworkAnimatedStyle,
            morphArtworkVisibilityStyle,
          ]}>
          <Animated.View style={[styles.artworkClip, artworkClipAnimatedStyle]}>
            <Image
              contentFit="cover"
              onLoad={() => setArtworkLoaded((value) => value + 1)}
              recyclingKey={currentSong.id}
              source={dataSaver && currentSong.imageSmall ? { uri: currentSong.imageSmall } : playerArtworkSource ? { uri: playerArtworkSource } : fallbackArtwork}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>

        <Animated.View
          pointerEvents={expanded ? 'auto' : 'none'}
          style={[
            styles.artworkPager,
            {
              left: fullArtwork.x,
              top: fullArtwork.y,
              width: fullArtwork.size,
              height: fullArtwork.size,
            },
            pagerAnimatedStyle,
          ]}>
          {expanded ? <SwipeableArtwork pageGap={fullArtwork.x + 8} size={fullArtwork.size} /> : null}
        </Animated.View>

        <CompactPlayer compactAnimatedStyle={compactAnimatedStyle} expanded={expanded} onExpand={onExpand} />
      </Animated.View>
    </GestureDetector>
  );
}

function CompactPlayer({
  compactAnimatedStyle,
  expanded,
  onExpand,
}: {
  compactAnimatedStyle: AnimatedStyle<ViewStyle>;
  expanded: boolean;
  onExpand: () => void;
}) {
  const { currentSong, isLiked, toggleLike, togglePlay } = usePlayer();
  const status = usePlayerStatus();
  const { colors, isDark, performanceMode } = useAppSettings();

  if (!currentSong) return null;

  const progress = status.duration > 0 ? Math.max(0, Math.min(1, status.currentTime / status.duration)) : 0;

  const contents = (
    <>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Pressable accessibilityLabel={`Open player for ${currentSong.title}`} onPress={() => onExpand()} style={styles.songArea}>
        <SwipeableSongCopy enabled={!expanded} leadingInset={42} />
      </Pressable>
      <BouncyPressable accessibilityLabel={isLiked ? 'Remove from favorites' : 'Add to favorites'} hitSlop={6} onPress={() => void toggleLike()} style={styles.control}>
        <SymbolView name={isLiked ? 'heart.fill' : 'heart'} size={21} style={styles.symbol} tintColor={isLiked ? colors.accent : colors.text} weight="semibold" />
      </BouncyPressable>
      <BouncyPressable accessibilityLabel={status.isBuffering ? 'Loading song' : status.playing ? 'Pause' : 'Play'} disabled={status.isBuffering} hitSlop={6} onPress={togglePlay} style={styles.control}>
        {status.isBuffering
          ? <ActivityIndicator color={isDark ? '#FFFFFF' : colors.text} size="small" />
          : <SymbolView name={status.playing ? 'pause.fill' : 'play.fill'} size={20} style={styles.symbol} tintColor={isDark ? '#FFFFFF' : colors.text} weight="bold" />}
      </BouncyPressable>
    </>
  );

  return (
    <Animated.View pointerEvents={expanded ? 'none' : 'auto'} style={[styles.compact, compactAnimatedStyle]}>
      {performanceMode ? (
        <View style={[styles.compactInterior, { backgroundColor: colors.elevated, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>{contents}</View>
      ) : (
        <GlassView
          colorScheme="auto"
          glassEffectStyle="regular"
          isInteractive
          style={styles.compactInterior}>
          {contents}
        </GlassView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  surface: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
  playerClip: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, overflow: 'hidden', borderCurve: 'continuous', transformOrigin: 'top center' },
  colorLayer: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#17171B' },
  full: { position: 'absolute', inset: 0, transformOrigin: 'top center' },
  compact: { position: 'absolute', top: 0, left: miniPlayerHorizontalInset, right: miniPlayerHorizontalInset, zIndex: 4, height: MINI_PLAYER_HEIGHT, borderRadius: 26, borderCurve: 'continuous', transformOrigin: 'center', shadowColor: '#000000', shadowOpacity: 0.34, shadowRadius: 18, shadowOffset: { width: 0, height: -5 } },
  compactInterior: { position: 'absolute', inset: 0, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 14, borderRadius: 26, borderCurve: 'continuous' },
  progressTrack: { position: 'absolute', top: 0, left: 14, right: 14, height: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  progressFill: { height: 2, borderRadius: 1, backgroundColor: '#D0A5FF' },
  songArea: { flex: 1, minWidth: 0, height: '100%' },
  morphArtwork: { position: 'absolute', zIndex: 7 },
  artworkPager: { position: 'absolute', zIndex: 8, overflow: 'visible' },
  artworkClip: { position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#282331', borderCurve: 'continuous' },
  control: { width: 40, height: 46, alignItems: 'center', justifyContent: 'center' },
  symbol: { width: 26, height: 26 },
});
