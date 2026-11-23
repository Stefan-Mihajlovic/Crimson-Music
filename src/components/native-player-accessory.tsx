/* eslint-disable react-hooks/immutability */
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, NativeModules, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, measure, useAnimatedReaction, useAnimatedRef, useSharedValue, withTiming, type AnimatedRef, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ArtworkImage from '@/components/artwork-image';
import { SymbolView } from '@/components/app-symbol';
import BouncyPressable from '@/components/bouncy-pressable';
import { SwipeableSongCopy } from '@/components/song-swipe-pager';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { selectionHaptic } from '@/services/haptics';

export type PlayerRect = { x: number; y: number; width: number; height: number };
export type PlayerDestination = PlayerRect & { inline: number };
export type NativePlayerFrame = PlayerRect & { inline: boolean; contentWidth?: number; contentHeight?: number; handoffToken?: string; restingFrame?: PlayerRect };
const fallbackArtwork = require('@/assets/images/home/default-song.webp');

async function beginNativeTransition(fallback: NativePlayerFrame): Promise<NativePlayerFrame> {
  try {
    const frame = await NativeModules.CrimsonRemoteControls?.beginPlayerTransition?.();
    if (frame && [frame.x, frame.y, frame.width, frame.height].every(Number.isFinite)
      && frame.width > 0 && frame.height > 0) return { ...frame, restingFrame: fallback };
  } catch { /* Older native builds use the already measured source frame. */ }
  return fallback;
}

/** UIKit owns both the glass and the scroll animation, including its inline layout.
 * Both placements are mounted concurrently: playback state stays in the provider.
 */
export function useNativePlayerGesture({ enabled, expanded, position, onBeginExpand, onExpand, onCollapse }: {
  enabled: boolean;
  expanded: boolean;
  position: SharedValue<number>;
  onBeginExpand: (frame: NativePlayerFrame) => void;
  onExpand: (velocity?: number) => void;
  onCollapse: (velocity?: number) => void;
}) {
  const { height } = useWindowDimensions();
  const { left: leftInset } = useSafeAreaInsets();
  const regularRef = useAnimatedRef<View>();
  const inlineRef = useAnimatedRef<View>();
  const presented = useSharedValue(expanded);
  useEffect(() => { presented.value = expanded; }, [expanded, presented]);
  const originFrame = useSharedValue<NativePlayerFrame | null>(null);
  const touchOrigin = useSharedValue({ x: 0, y: 0 });
  const origin = useSharedValue(0);
  const active = useSharedValue(false);
  const surfaceReady = useSharedValue(false);
  const translation = useSharedValue(0);
  const handoffTranslation = useSharedValue(0);
  const catchupOffset = useSharedValue(0);
  useAnimatedReaction(
    () => ({ tracking: active.value && surfaceReady.value, y: translation.value, offset: catchupOffset.value }),
    (value) => {
      if (value.tracking) position.value = Math.max(0, Math.min(origin.value,
        origin.value + value.y - handoffTranslation.value - value.offset));
    },
  );
  const handoff = useRef<Promise<void> | null>(null);
  const mounted = useRef<Promise<void> | null>(null);
  const resolveMounted = useRef<(() => void) | null>(null);
  const pending = useRef(false);
  const source = useRef<NativePlayerFrame | null>(null);
  useEffect(() => { if (!expanded) pending.current = false; }, [expanded]);
  useEffect(() => () => { NativeModules.CrimsonRemoteControls?.cancelPlayerTransition?.(); }, []);
  const onSurfaceReady = useCallback(async () => {
    const resolve = resolveMounted.current;
    if (!resolve) return;
    resolveMounted.current = null;
    try {
      if (source.current?.handoffToken) {
        await NativeModules.CrimsonRemoteControls?.finishPlayerTransition?.(source.current.handoffToken);
      }
    } finally {
      scheduleOnUI(() => {
        // Preserve movement made while React mounts. Ease out only that small
        // mounting offset, rather than treating all of it as a new dead zone.
        catchupOffset.value = translation.value - handoffTranslation.value;
        surfaceReady.value = true;
        catchupOffset.value = withTiming(0, { duration: 80 });
      });
      resolve();
    }
  }, [catchupOffset, handoffTranslation, surfaceReady, translation]);
  const beginHandoff = useCallback((frame: NativePlayerFrame) => {
    if (pending.current) return handoff.current;
    pending.current = true;
    mounted.current = new Promise((resolve) => { resolveMounted.current = resolve; });
    handoff.current = beginNativeTransition(frame).then((measured) => {
      source.current = measured;
      origin.value = measured.y;
      position.value = measured.y;
      onBeginExpand(measured);
    });
    return handoff.current;
  }, [onBeginExpand, origin, position]);
  const open = useCallback(async (frame: NativePlayerFrame) => {
    if (pending.current) return;
    await beginHandoff(frame);
    await mounted.current;
    onExpand();
    selectionHaptic();
  }, [beginHandoff, onExpand]);
  const finishHandoff = useCallback(async (open: boolean, velocity: number) => {
    // A fast flick can end while the main-thread geometry sample is in flight.
    // Install the single morph surface before starting its settling animation.
    await handoff.current;
    await mounted.current;
    if (open) onExpand(velocity);
    else onCollapse(velocity);
  }, [onCollapse, onExpand]);
  const gesture = useMemo(() => Gesture.Pan()
    .enabled(enabled)
    .hitSlop({ top: -Math.max(0, height - 180) })
    .manualActivation(true)
    // Once this is a vertical drag, cancel the accessory's press interaction.
    // Otherwise a short drag can also finish as the underlying open-player tap.
    .cancelsTouchesInView(true)
    // This recognizer stays on the app host when UIKit removes the accessory.
    // Fail immediately outside its measured bounds so content scrolling and
    // the fullscreen player's own gesture retain their normal ownership.
    .onTouchesDown((event, manager) => {
      const touch = event.allTouches[0];
      originFrame.value = null;
      if (presented.value || !touch) { manager.fail(); return; }
      const regular = measure(regularRef);
      const inline = measure(inlineRef);
      const containsTouch = (frame: typeof regular) => frame && frame.width > 0 && frame.height > 0
        && touch.absoluteX >= frame.pageX && touch.absoluteX <= frame.pageX + frame.width
        && touch.absoluteY >= frame.pageY && touch.absoluteY <= frame.pageY + frame.height;
      const frame = containsTouch(regular) ? regular : containsTouch(inline) ? inline : null;
      if (!frame) {
        manager.fail();
        return;
      }
      // UIKit keeps a 48pt content host in both placements. The inline accessory
      // moves to the right of the selected-tab button; height cannot identify it.
      originFrame.value = { x: frame.pageX, y: frame.pageY, width: frame.width, height: frame.height, inline: frame.pageX > (leftInset || 0) + 40 };
      touchOrigin.value = { x: touch.absoluteX, y: touch.absoluteY };
    })
    .onTouchesMove((event, manager) => {
      if (active.value) return;
      const touch = event.allTouches[0];
      if (!originFrame.value || !touch) { manager.fail(); return; }
      const dx = touch.absoluteX - touchOrigin.value.x;
      const dy = touch.absoluteY - touchOrigin.value.y;
      if (Math.abs(dx) > 12 || dy > 6) manager.fail();
      else if (dy < -2 && Math.abs(dy) > Math.abs(dx) * 1.3) manager.activate();
    })
    // This callback runs on the UI thread when the gesture starts, not in render.
    // eslint-disable-next-line react-hooks/refs -- RNGH registers this event callback; it does not execute it during render.
    .onStart((event) => {
      const frame = originFrame.value;
      if (!frame) return;
      cancelAnimation(position);
      active.value = true;
      presented.value = true;
      origin.value = frame.y;
      surfaceReady.value = false;
      translation.value = event.translationY;
      handoffTranslation.value = event.translationY;
      catchupOffset.value = 0;
      position.value = frame.y;
      scheduleOnRN(beginHandoff, frame);
    })
    .onUpdate((event) => {
      translation.value = event.translationY;
    })
    // eslint-disable-next-line react-hooks/refs -- RNGH registers this event callback; it does not execute it during render.
    .onEnd((event) => {
      if (!active.value) return;
      active.value = false;
      const travel = surfaceReady.value ? origin.value - position.value : -Math.min(0, translation.value);
      scheduleOnRN(finishHandoff, travel - event.velocityY * 0.12 > 100, event.velocityY);
    })
    // eslint-disable-next-line react-hooks/refs -- RNGH registers this event callback; it does not execute it during render.
    .onFinalize(() => {
      originFrame.value = null;
      if (!active.value) return;
      active.value = false;
      scheduleOnRN(finishHandoff, false, 0);
    }), [active, beginHandoff, catchupOffset, enabled, finishHandoff, handoffTranslation, height, inlineRef, leftInset, origin, originFrame, position, presented, regularRef, surfaceReady, touchOrigin, translation]);
  return { gesture, regularRef, inlineRef, onSurfaceReady, open };
}

export default function NativePlayerAccessory({ expanded, onOpen, regularRef, inlineRef }: {
  expanded: boolean;
  onOpen: (frame: NativePlayerFrame) => void;
  regularRef: AnimatedRef<View>;
  inlineRef: AnimatedRef<View>;
}) {
  const inline = NativeTabs.BottomAccessory.usePlacement() === 'inline';
  const ref = inline ? inlineRef : regularRef;
  const open = () => {
    if (expanded) return;
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) onOpen({ x, y, width, height, inline });
    });
  };

  return (
    <Animated.View ref={ref} collapsable={false} style={[styles.fill, expanded && styles.hidden]}
      pointerEvents={expanded ? 'none' : 'auto'} accessibilityElementsHidden={expanded} importantForAccessibility={expanded ? 'no-hide-descendants' : 'auto'}>
      <AccessoryPlayerContents inline={inline} onExpand={open} />
    </Animated.View>
  );
}

/** Also used by the fullscreen morph, so its final frame matches the accessory. */
export function AccessoryPlayerContents({ inline, onExpand, artworkHidden = false, swipeEnabled = true }: {
  inline: boolean;
  onExpand: () => void;
  artworkHidden?: boolean;
  swipeEnabled?: boolean;
}) {
  const { currentSong, isLiked, toggleLike, togglePlay } = usePlayer();
  const status = usePlayerStatus();
  const { colors, dataSaver } = useAppSettings();
  if (!currentSong) return null;
  const artworkSize = inline ? 26 : 34;
  return (
    <View style={[styles.contents, inline && styles.inlineContents]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open player for ${currentSong.title}`}
        onPress={onExpand} style={styles.song}>
        <View style={{ width: artworkSize, height: artworkSize }}>
          {!artworkHidden ? <ArtworkImage artwork={currentSong.artwork} contentFit="cover" recyclingKey={currentSong.id}
            source={dataSaver && currentSong.imageSmall ? { uri: currentSong.imageSmall } : currentSong.image ? { uri: currentSong.image } : fallbackArtwork}
            style={[styles.artwork, { width: artworkSize, height: artworkSize }]} /> : null}
        </View>
        <SwipeableSongCopy compact={inline} fadeOverflow enabled={swipeEnabled} />
      </Pressable>
      {!inline ? <BouncyPressable accessibilityLabel={isLiked ? 'Remove from favorites' : 'Add to favorites'}
        onPress={() => void toggleLike()} style={styles.control}>
        <SymbolView name={isLiked ? 'heart.fill' : 'heart'} size={25} tintColor={isLiked ? colors.accent : colors.text} weight="semibold" />
      </BouncyPressable> : null}
      <BouncyPressable accessibilityLabel={status.isBuffering ? 'Cancel loading' : status.playing ? 'Pause' : 'Play'}
        onPress={togglePlay} style={[styles.control, inline && styles.inlineControl]}>
        {status.isBuffering ? <ActivityIndicator color={colors.text} size="small" />
          : <SymbolView name={status.playing ? 'pause.fill' : 'play.fill'} size={inline ? 17 : 20} tintColor={colors.text} weight="bold" />}
      </BouncyPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { opacity: 0 },
  contents: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 3 },
  inlineContents: { paddingHorizontal: 8 },
  song: { flex: 1, minWidth: 0, height: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  artwork: { borderRadius: 8, borderCurve: 'continuous' },
  control: { width: 44, height: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  inlineControl: { width: 36, minHeight: 32 },
});
