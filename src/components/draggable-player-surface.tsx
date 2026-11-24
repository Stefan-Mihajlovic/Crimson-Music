import { useFoldingFeature } from '@/hooks/use-folding-feature';
import { playerPanes } from '@/services/adaptive-layout';
import { BrandAccent } from '@/constants/brand-accent';
import FrostedSurface from '@/components/frosted-surface';
/* eslint-disable react-hooks/immutability */

import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import ArtworkImage from '@/components/artwork-image';
import { SymbolView } from '@/components/app-symbol';
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
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { getPlayerArtworkLayout, PlayerContent } from '@/app/player';
import { BOTTOM_BAR_HORIZONTAL_INSET, MINI_PLAYER_HEIGHT } from '@/components/player-layout';
import { SwipeableArtwork, SwipeableSongCopy } from '@/components/song-swipe-pager';
import BouncyPressable from '@/components/bouncy-pressable';
import { AccessoryPlayerContents, type NativePlayerFrame, type PlayerDestination } from '@/components/native-player-accessory';
import PlayerArtworkBackground from '@/components/player-artwork-background';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';

const fallbackArtwork = require('@/assets/images/home/default-song.webp');
const miniPlayerHorizontalInset = BOTTOM_BAR_HORIZONTAL_INSET;
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

type PlayerSurfaceProps = {
  collapsedTop: number;
  expanded: boolean;
  height: number;
  nativeAccessory?: boolean;
  nativeFrame?: NativePlayerFrame | null;
  onBeginExpand: () => void;
  onSurfaceReady?: () => void;
  onCollapse: (velocity?: number) => void;
  onExpand: (velocity?: number) => void;
  position: SharedValue<number>;
  returnProgress?: SharedValue<number>;
  returnFrame?: SharedValue<PlayerDestination | null>;
};

export default function DraggablePlayerSurface(props: PlayerSurfaceProps) {
  // useAnimatedStyle retains its first computed style for attaching native
  // views. Keeping those hooks alive behind `return null` seeds the next open
  // with stale regular/fullscreen geometry before the UI mapper catches up.
  // Mount the entire morph only once its native frame has been captured.
  if (props.nativeAccessory && !props.expanded) return null;
  return <PlayerSurface {...props} />;
}

function PlayerSurface({
  collapsedTop,
  expanded,
  height,
  nativeAccessory = false,
  nativeFrame,
  onBeginExpand,
  onSurfaceReady,
  onCollapse,
  onExpand,
  position,
  returnProgress,
  returnFrame,
}: PlayerSurfaceProps) {
  const { currentSong } = usePlayer();
  const { dataSaver, reduceMotion, isDark } = useAppSettings();
  const [artworkLoaded, setArtworkLoaded] = useState(0);
  const [laidOut, setLaidOut] = useState(false);
  const [artworkDisplayed, setArtworkDisplayed] = useState(false);
  useEffect(() => {
    if (laidOut && artworkDisplayed) onSurfaceReady?.();
  }, [laidOut, artworkDisplayed, onSurfaceReady]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fold = useFoldingFeature();
  const panes = playerPanes(width, height, insets, fold);
  const fullArtwork = getPlayerArtworkLayout(width, height, insets.top, insets.bottom, insets.left, insets.right, fold);
  const expansionHandleBottom = fullArtwork.y + fullArtwork.size;
  const expansionHandleRight = panes.mode !== 'compact' ? fullArtwork.x + fullArtwork.size : width;
  const expansionHeaderBottom = Math.max(insets.top, 18) + 52;
  const safeCollapsedTop = Math.max(1, collapsedTop);
  const dragStartPosition = useSharedValue(expanded ? 0 : collapsedTop);
  const gestureActive = useSharedValue(false);
  const heldTransition = useSharedValue(false);
  const expandedGesture = useSharedValue(expanded);
  const entranceProgress = useSharedValue(currentSong ? 1 : 0);

  useEffect(() => { expandedGesture.set(expanded); }, [expanded, expandedGesture]);

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

  // UIKit does not expose the physical display radius to apps. The top safe
  // area tracks the rounded-display generations closely, while continuous
  // corners reproduce the same superellipse curve used by the device bezel.
  const deviceCornerRadius = insets.top > 24
    ? Math.max(36, Math.min(56, insets.top - 6))
    : 0;
  const miniHeight = nativeFrame?.height ?? MINI_PLAYER_HEIGHT;
  const miniLeft = nativeFrame?.x ?? miniPlayerHorizontalInset;
  const miniWidth = nativeFrame?.width ?? width - miniPlayerHorizontalInset * 2;
  const logicalWidth = nativeFrame?.contentWidth || miniWidth;
  const logicalHeight = nativeFrame?.contentHeight || miniHeight;
  const fullArtworkRadius = 28;
  const miniArtworkRadius = 8;
  const mini = useDerivedValue(() => {
    const target = returnFrame?.value ?? nativeFrame?.restingFrame;
    const t = target ? returnProgress?.value ?? 0 : 0;
    const mix = (start: number, end: number) => start + (end - start) * t;
    const x = mix(miniLeft, target?.x ?? miniLeft);
    const y = mix(safeCollapsedTop, target?.y ?? safeCollapsedTop);
    const w = mix(miniWidth, target?.width ?? miniWidth);
    const h = mix(miniHeight, target?.height ?? miniHeight);
    const inline = mix(Number(Boolean(nativeFrame?.inline)), returnFrame?.value?.inline ?? Number(Boolean(nativeFrame?.inline)));
    const contentWidth = mix(logicalWidth, target?.width ?? logicalWidth);
    const contentHeight = mix(logicalHeight, target?.height ?? logicalHeight);
    const artSize = 34 - 8 * inline;
    return { x, y, width: w, height: h, inline, contentWidth, contentHeight,
      scaleX: w / contentWidth, scaleY: h / contentHeight,
      artworkX: x + (14 - 6 * inline) * w / contentWidth,
      artworkY: (h - artSize * h / contentHeight) / 2,
      artworkWidth: artSize * w / contentWidth,
      artworkHeight: artSize * h / contentHeight };
  });
  // Closing can rebound past the mini position; finger tracking stays clamped.
  // Bound that travel so a fast flick cannot reach the home indicator. UIKit
  // takes over only after the spring has come to rest.
  const surfacePosition = useDerivedValue(() => {
    if (!nativeAccessory) return position.value;
    const excess = Math.max(0, position.value - safeCollapsedTop);
    return Math.max(0, Math.min(safeCollapsedTop, position.value)) + 12 * excess / (12 + excess);
  });
  const surfaceTop = useDerivedValue(() => surfacePosition.value
    + (mini.value.y - safeCollapsedTop) * Math.max(0, Math.min(1, position.value / safeCollapsedTop)));
  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-4, 4])
    .failOffsetX([-12, 12])
    .onTouchesDown((event, manager) => {
      const touch = event.allTouches[0];
      if (!touch) { manager.fail(); return; }
      if (nativeAccessory) {
        // Hit-test the visible, moving card in window coordinates. Gesture
        // touch.y can belong to a nested/fullscreen child, even while that
        // child is visually clipped to the small capsule during settling.
        const t = Math.max(0, Math.min(1, position.value / safeCollapsedTop));
        const left = mini.value.x * t;
        const cardWidth = width + (mini.value.width - width) * t;
        const cardHeight = height + (mini.value.height - height) * t;
        const localY = touch.absoluteY - surfaceTop.value;
        if (touch.absoluteX < left || touch.absoluteX > left + cardWidth
          || localY < 0 || localY > cardHeight) { manager.fail(); return; }
        // Every visible part of a transitioning card is a handle. At rest in
        // fullscreen, leave transport controls and content scrolling alone.
        if (position.value <= 1 && localY > expansionHeaderBottom
          && (localY > expansionHandleBottom || touch.absoluteX > expansionHandleRight)) { manager.fail(); return; }
        if (position.value > 1) {
          // Hold the moving card at touch-down, not after the pan threshold.
          // Otherwise it can unmount between finger-down and finger-up and
          // swallow a perfectly valid tap near the end of the closing spring.
          cancelAnimation(position);
          if (returnProgress) cancelAnimation(returnProgress);
          if (returnFrame) cancelAnimation(returnFrame);
          heldTransition.value = true;
          scheduleOnRN(onBeginExpand);
        }
      } else if (expandedGesture.get() && touch.y > expansionHeaderBottom
        && (touch.y > expansionHandleBottom || touch.x > expansionHandleRight)) manager.fail();
    })
    .onStart(() => {
      cancelAnimation(position);
      if (returnProgress) cancelAnimation(returnProgress);
      if (returnFrame) cancelAnimation(returnFrame);
      gestureActive.value = true;
      dragStartPosition.value = position.value;
      if (!heldTransition.value) scheduleOnRN(onBeginExpand);
      heldTransition.value = false;
    })
    .onUpdate((event) => {
      position.value = Math.max(0, Math.min(Math.max(safeCollapsedTop, dragStartPosition.value), dragStartPosition.value + event.translationY));
    })
    .onEnd((event) => {
      gestureActive.value = false;
      const currentPosition = Math.max(0, Math.min(safeCollapsedTop, position.value));
      if (nativeAccessory) {
        // A short deliberate pull/flick is enough; reversing a closing card
        // should reopen it even when it is already near the bottom.
        const projectedTravel = event.translationY + event.velocityY * 0.18;
        if (event.translationY > 8 && projectedTravel > 72) scheduleOnRN(onCollapse, event.velocityY);
        else if (event.translationY < -8 && projectedTravel < -72) scheduleOnRN(onExpand, event.velocityY);
        else if (currentPosition > safeCollapsedTop * 0.5) scheduleOnRN(onCollapse, event.velocityY);
        else scheduleOnRN(onExpand, event.velocityY);
      } else if (currentPosition + event.velocityY * 0.12 > safeCollapsedTop * 0.5) scheduleOnRN(onCollapse, event.velocityY);
      else scheduleOnRN(onExpand, event.velocityY);
    })
    .onFinalize((_, success) => {
      if (success || !gestureActive.value) return;
      gestureActive.value = false;
      if (position.value > safeCollapsedTop * 0.5) scheduleOnRN(onCollapse, 0);
      else scheduleOnRN(onExpand, 0);
    }), [dragStartPosition, expandedGesture, expansionHandleBottom, expansionHandleRight, expansionHeaderBottom,
      gestureActive, height, heldTransition, mini, nativeAccessory, onBeginExpand, onCollapse, onExpand, position, returnFrame, returnProgress, safeCollapsedTop, surfaceTop, width]);
  const gesture = useMemo(() => {
    if (!nativeAccessory) return pan;
    // The native accessory is detached until settling finishes. Its temporary
    // replacement must therefore accept taps as well as drags during that time.
    const tap = Gesture.Tap().maxDistance(8)
      .onTouchesDown((event, manager) => {
        const touch = event.allTouches[0];
        const t = Math.max(0, Math.min(1, position.value / safeCollapsedTop));
        const left = mini.value.x * t;
        const cardWidth = width + (mini.value.width - width) * t;
        const cardHeight = height + (mini.value.height - height) * t;
        if (!touch || position.value <= 1 || touch.absoluteX < left || touch.absoluteX > left + cardWidth
          || touch.absoluteY < surfaceTop.value || touch.absoluteY > surfaceTop.value + cardHeight) manager.fail();
      })
      .onEnd((_, success) => {
        if (!success) return;
        heldTransition.value = false;
        cancelAnimation(position);
        if (returnProgress) cancelAnimation(returnProgress);
        if (returnFrame) cancelAnimation(returnFrame);
        scheduleOnRN(onExpand);
      })
      .onFinalize(() => {
        // A cancelled tap / sideways movement must not leave a held card stuck.
        // A successful pan clears this flag when it takes ownership.
        if (!heldTransition.value) return;
        heldTransition.value = false;
        if (position.value > safeCollapsedTop * 0.5) scheduleOnRN(onCollapse, 0);
        else scheduleOnRN(onExpand, 0);
      });
    return Gesture.Exclusive(pan, tap);
  }, [height, heldTransition, mini, nativeAccessory, onCollapse, onExpand, pan, position, returnFrame, returnProgress, safeCollapsedTop, surfaceTop, width]);
  const contentPosition = position;
  // Keep the native GlassView fully opaque while it mounts. Animating an
  // ancestor from opacity 0 can prevent iOS from establishing glass compositing.
  const surfaceAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: surfaceTop.value + interpolate(
        entranceProgress.value,
        [0, 1],
        [18, 0],
        Extrapolation.CLAMP,
      ),
    }],
  }));
  // Animate the clipping bounds, never the scale of the text/control layer.
  // Nested scale + inverse-scale transforms make Core Animation resample the
  // rounded offscreen surface during a gesture, even when their net scale is 1.
  // The child keeps its full dimensions so resizing the mask cannot reflow it.
  const playerClipAnimatedStyle = useAnimatedStyle(() => ({
    left: interpolate(position.value, [0, safeCollapsedTop], [0, mini.value.x], Extrapolation.CLAMP),
    width: interpolate(position.value, [0, safeCollapsedTop], [width, mini.value.width], Extrapolation.CLAMP),
    height: interpolate(position.value, [0, safeCollapsedTop], [height, mini.value.height], Extrapolation.CLAMP),
    borderRadius: interpolate(position.value, [0, safeCollapsedTop], [deviceCornerRadius, mini.value.height / 2], Extrapolation.CLAMP),
  }));
  // Round the material itself, not just its parent's clipping mask: UIKit's
  // refraction follows the GlassView's own corner configuration.
  const glassAnimatedStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(position.value, [0, safeCollapsedTop], [deviceCornerRadius, mini.value.height / 2], Extrapolation.CLAMP),
  }));
  const clipContentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -interpolate(contentPosition.value, [0, safeCollapsedTop], [0, mini.value.x], Extrapolation.CLAMP) }],
  }));
  const colorLayerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(contentPosition.value, [0, safeCollapsedTop * (nativeAccessory ? 0.82 : 0.955), safeCollapsedTop], [1, 1, 0], Extrapolation.CLAMP),
  }));
  const bodyAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(contentPosition.value, [0, safeCollapsedTop * 0.58, safeCollapsedTop * 0.92], [1, 0.58, 0], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(contentPosition.value, [0, safeCollapsedTop * 0.88], [0, 74], Extrapolation.CLAMP),
    }],
  }));
  const topBarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(contentPosition.value, [0, safeCollapsedTop * 0.14, safeCollapsedTop * 0.44], [1, 0.2, 0], Extrapolation.CLAMP),
    transform: [{
      translateY: interpolate(contentPosition.value, [0, safeCollapsedTop * 0.44], [0, -28], Extrapolation.CLAMP),
    }],
  }));
  const artworkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(contentPosition.value, [0, safeCollapsedTop], [0, mini.value.artworkX - fullArtwork.x], Extrapolation.CLAMP) },
      { translateY: interpolate(contentPosition.value, [0, safeCollapsedTop], [0, mini.value.artworkY - fullArtwork.y], Extrapolation.CLAMP) },
      { scaleX: interpolate(contentPosition.value, [0, safeCollapsedTop], [1, mini.value.artworkWidth / fullArtwork.size], Extrapolation.CLAMP) },
      { scaleY: interpolate(contentPosition.value, [0, safeCollapsedTop], [1, mini.value.artworkHeight / fullArtwork.size], Extrapolation.CLAMP) },
    ],
  }));
  const artworkClipAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(contentPosition.value, [0, safeCollapsedTop], [1, mini.value.artworkWidth / fullArtwork.size], Extrapolation.CLAMP);
    const displayedRadius = interpolate(contentPosition.value, [0, safeCollapsedTop], [fullArtworkRadius, miniArtworkRadius], Extrapolation.CLAMP);
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
    opacity: interpolate(contentPosition.value, [safeCollapsedTop * (nativeAccessory ? 0.94 : 0.955), safeCollapsedTop], [0, 1], Extrapolation.CLAMP),
    ...(nativeFrame ? { left: mini.value.x, width: mini.value.contentWidth, height: mini.value.contentHeight, transform: [{ scaleX: mini.value.scaleX }, { scaleY: mini.value.scaleY }] } : {}),
  }));

  const regularCopyStyle = useAnimatedStyle(() => ({ opacity: 1 - mini.value.inline }));
  const inlineCopyStyle = useAnimatedStyle(() => ({ opacity: mini.value.inline }));

  if (!currentSong) return null;

  const playerArtworkSource = currentSong.image || currentSong.imageSmall;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        onLayout={() => setLaidOut(true)}
        pointerEvents={expanded ? 'auto' : 'box-none'}
        style={[styles.surface, { height }, surfaceAnimatedStyle]}>
        <Animated.View
          pointerEvents={expanded ? 'auto' : 'none'}
          style={[
            styles.playerClip,
            playerClipAnimatedStyle,
          ]}>
          {nativeAccessory ? <AnimatedGlassView colorScheme={isDark ? 'dark' : 'light'}
            glassEffectStyle="regular" style={[StyleSheet.absoluteFill, glassAnimatedStyle]} /> : null}
          <Animated.View style={[styles.clipContent, { height, width }, clipContentAnimatedStyle]}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.colorLayer,
                  colorLayerAnimatedStyle,
                  {
                    height,
                  },
                ]}>
                <PlayerArtworkBackground active={expanded} artworkLayout={fullArtwork} artworkLoaded={artworkLoaded} song={currentSong} />
              </Animated.View>

              <Animated.View style={[styles.full, { height, width }]}>
                {expanded ? (
                  <PlayerContent
                    artworkHidden
                    bodyAnimatedStyle={bodyAnimatedStyle}
                    onClose={() => onCollapse()}
                    topBarAnimatedStyle={topBarAnimatedStyle}
                  />
                ) : null}
              </Animated.View>
              {nativeAccessory ? <CompactPlayer compactAnimatedStyle={compactAnimatedStyle} expanded={expanded}
                onExpand={onExpand} nativeFrame={nativeFrame} contentsOnly
                regularCopyStyle={regularCopyStyle} inlineCopyStyle={inlineCopyStyle} /> : null}
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
            <ArtworkImage
              artwork={currentSong.artwork}
              contentFit="cover"
              onDisplay={() => setArtworkDisplayed(true)}
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
          {expanded ? <SwipeableArtwork pageGap={width > height ? width - fullArtwork.size : fullArtwork.x + 8} size={fullArtwork.size} /> : null}
        </Animated.View>

        {!nativeAccessory ? <CompactPlayer compactAnimatedStyle={compactAnimatedStyle} expanded={expanded} onExpand={onExpand} /> : null}
      </Animated.View>
    </GestureDetector>
  );
}

function CompactPlayer({
  compactAnimatedStyle,
  expanded,
  onExpand,
  nativeFrame,
  contentsOnly = false,
  regularCopyStyle,
  inlineCopyStyle,
}: {
  compactAnimatedStyle: AnimatedStyle<ViewStyle>;
  expanded: boolean;
  onExpand: () => void;
  nativeFrame?: NativePlayerFrame | null;
  contentsOnly?: boolean;
  regularCopyStyle?: AnimatedStyle<ViewStyle>;
  inlineCopyStyle?: AnimatedStyle<ViewStyle>;
}) {
  const { currentSong, isLiked, toggleLike, togglePlay } = usePlayer();
  const status = usePlayerStatus();
  const { colors, isDark, performanceMode } = useAppSettings();

  if (!currentSong) return null;

  const progress = status.duration > 0 ? Math.max(0, Math.min(1, status.currentTime / status.duration)) : 0;

  const contents = nativeFrame ? <AccessoryPlayerContents inline={nativeFrame.inline} onExpand={onExpand} artworkHidden swipeEnabled={false} /> : (
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
      <BouncyPressable accessibilityLabel={status.isBuffering ? 'Cancel loading' : status.playing ? 'Pause' : 'Play'} hitSlop={6} onPress={togglePlay} style={styles.control}>
        {status.isBuffering
          ? <ActivityIndicator color={isDark ? '#FFFFFF' : colors.text} size="small" />
          : <SymbolView name={status.playing ? 'pause.fill' : 'play.fill'} size={20} style={styles.symbol} tintColor={isDark ? '#FFFFFF' : colors.text} weight="bold" />}
      </BouncyPressable>
    </>
  );

  // The iPhone mini controls share the growing surface's glass and clipping
  // bounds. A second fixed-size GlassView here creates a second capsule.
  if (contentsOnly && nativeFrame) return <Animated.View pointerEvents="none" style={[
    { position: 'absolute', left: nativeFrame.x, top: 0,
      width: nativeFrame.contentWidth || nativeFrame.width, height: nativeFrame.contentHeight || nativeFrame.height,
      transformOrigin: 'top left', transform: [
        { scaleX: nativeFrame.width / (nativeFrame.contentWidth || nativeFrame.width) },
        { scaleY: nativeFrame.height / (nativeFrame.contentHeight || nativeFrame.height) },
      ] },
    compactAnimatedStyle,
  ]}>
    <Animated.View style={[StyleSheet.absoluteFill, regularCopyStyle]}><AccessoryPlayerContents inline={false} onExpand={onExpand} artworkHidden swipeEnabled={false} /></Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, inlineCopyStyle]}><AccessoryPlayerContents inline onExpand={onExpand} artworkHidden swipeEnabled={false} /></Animated.View>
  </Animated.View>;

  return (
    <Animated.View pointerEvents={expanded ? 'none' : 'auto'} style={[styles.compact,
      nativeFrame && { left: nativeFrame.x, right: undefined, width: nativeFrame.width, height: nativeFrame.height, borderRadius: nativeFrame.height / 2 },
      compactAnimatedStyle]}>
      {performanceMode || !isGlassEffectAPIAvailable() || !isLiquidGlassAvailable() ? (
        <FrostedSurface radius={nativeFrame ? nativeFrame.height / 2 : 26}
          style={[styles.compactInterior, nativeFrame && { paddingHorizontal: 0, borderRadius: nativeFrame.height / 2 }]}>{contents}</FrostedSurface>
      ) : (
        <GlassView
          colorScheme={isDark ? 'dark' : 'light'}
          glassEffectStyle="regular"
          isInteractive
          style={[styles.compactInterior, nativeFrame && { paddingHorizontal: 0, borderRadius: nativeFrame.height / 2 }]}>
          {contents}
        </GlassView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  surface: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 },
  playerClip: { position: 'absolute', top: 0, left: 0, zIndex: 6, overflow: 'hidden', borderCurve: 'continuous' },
  clipContent: { position: 'absolute', top: 0, left: 0, right: 0 },
  colorLayer: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#17171B' },
  full: { position: 'absolute', top: 0, left: 0 },
  compact: { position: 'absolute', top: 0, left: miniPlayerHorizontalInset, right: miniPlayerHorizontalInset, zIndex: 4, height: MINI_PLAYER_HEIGHT, borderRadius: 26, borderCurve: 'continuous', transformOrigin: 'center', shadowColor: '#000000', shadowOpacity: 0.34, shadowRadius: 18, shadowOffset: { width: 0, height: -5 } },
  compactInterior: { position: 'absolute', inset: 0, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 14, borderRadius: 26, borderCurve: 'continuous' },
  progressTrack: { position: 'absolute', top: 0, left: 14, right: 14, height: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  progressFill: { height: 2, borderRadius: 1, backgroundColor: BrandAccent.dark },
  songArea: { flex: 1, minWidth: 0, height: '100%' },
  morphArtwork: { position: 'absolute', zIndex: 7 },
  artworkPager: { position: 'absolute', zIndex: 8, overflow: 'visible' },
  artworkClip: { position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: '#282331', borderCurve: 'continuous' },
  control: { width: 40, height: 46, alignItems: 'center', justifyContent: 'center' },
  symbol: { width: 26, height: 26 },
});
