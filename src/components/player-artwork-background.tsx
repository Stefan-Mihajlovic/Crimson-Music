/* eslint-disable react-hooks/immutability */

import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { useAppSettings } from '@/providers/settings-provider';
import {
  type ArtworkPalette,
  fallbackArtworkPalette,
  getArtworkPalette,
  getCachedArtworkPalette,
} from '@/services/artwork-palette';
import type { CrimsonSong } from '@/types/music';

type PaletteState = { current: ArtworkPalette; previous: ArtworkPalette | null };

export default function PlayerArtworkBackground({
  active,
  song,
  artworkLoaded = 0,
}: {
  active: boolean;
  song: CrimsonSong | null;
  artworkLoaded?: number;
}) {
  const { dataSaver, performanceMode, reduceMotion } = useAppSettings();
  const systemMotionAtLaunch = useReducedMotion();
  const [systemReduceMotion, setSystemReduceMotion] = useState(systemMotionAtLaunch);
  const { width, height } = useWindowDimensions();
  const source = song?.imageSmall || song?.image;
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [palette, setPalette] = useState<PaletteState>(() => ({
    current: getCachedArtworkPalette(source) || fallbackArtworkPalette,
    previous: null,
  }));
  const currentPalette = useRef(palette.current);
  const transitionID = useRef(0);
  const phase = useSharedValue(0);
  const transition = useSharedValue(1);
  // Data Saver only controls palette downloads. Moving cached color textures
  // consumes no data, and uses the same compositor in either network setting.
  const animate = active && appActive && !reduceMotion && !systemReduceMotion && !performanceMode;
  const finishTransition = useCallback((id: number) => {
    if (transitionID.current === id) setPalette((value) => value.previous ? { current: value.current, previous: null } : value);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let live = true;
    let receivedChange = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      receivedChange = true;
      setSystemReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (live && !receivedChange) setSystemReduceMotion(enabled);
    }).catch(() => {});
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    cancelAnimation(phase);
    if (animate) {
      // Three static gradients move as composited layers. No audio sampling,
      // image blurring, JS timers, or pixel work occurs on animation frames.
      // Accessibility is handled by the live gate above. Explicit timing avoids
      // a repeat silently ending from a separate, launch-time motion setting.
      phase.value = withRepeat(withTiming(phase.value + 1, {
        duration: 18000,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }), -1, false, undefined, ReduceMotion.Never);
    }
    return () => cancelAnimation(phase);
  }, [animate, phase]);

  useEffect(() => {
    if (!active || !appActive) return;
    let live = true;
    const request = source ? getArtworkPalette(source, {
      allowNetwork: !dataSaver && !performanceMode && Boolean(song?.imageSmall),
      alternativeSource: song?.image,
    }) : Promise.resolve(fallbackArtworkPalette);
    void request.then((result) => {
      const next = result || fallbackArtworkPalette;
      if (!live || next === currentPalette.current) return;
      const previous = currentPalette.current;
      currentPalette.current = next;
      const id = ++transitionID.current;
      cancelAnimation(transition);
      transition.value = animate ? 0 : 1;
      setPalette({ current: next, previous: animate ? previous : null });
      if (animate) transition.value = withTiming(1, {
        duration: 1100,
        easing: Easing.inOut(Easing.cubic),
        reduceMotion: ReduceMotion.Never,
      }, (finished) => {
        if (finished) scheduleOnRN(finishTransition, id);
      });
    });
    return () => { live = false; };
  }, [active, animate, appActive, artworkLoaded, dataSaver, finishTransition, performanceMode, song?.image, song?.imageSmall, source, transition]);

  useEffect(() => {
    if (!animate) {
      cancelAnimation(transition);
      transition.value = 1;
      finishTransition(transitionID.current);
    }
  }, [animate, finishTransition, transition]);

  const currentStyle = useAnimatedStyle(() => ({ opacity: transition.value }));
  const previousStyle = useAnimatedStyle(() => ({ opacity: 1 - transition.value }));

  return (
    <View pointerEvents="none" style={styles.background}>
      {palette.previous && animate ? (
        <Animated.View style={[StyleSheet.absoluteFill, previousStyle]}>
          <ColorField colors={palette.previous} height={height} phase={phase} simplified={false} width={width} />
        </Animated.View>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, currentStyle]}>
        <ColorField colors={palette.current} height={height} phase={phase} simplified={performanceMode} width={width} />
      </Animated.View>
      <LinearGradient
        colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.44)', 'rgba(0,0,0,0.48)']}
        locations={[0, 0.42, 0.76, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function shade(hex: string, amount: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${Math.round((value >> 16) * amount)},${Math.round(((value >> 8) & 255) * amount)},${Math.round((value & 255) * amount)})`;
}

const ColorField = memo(function ColorField({ colors, height, phase, simplified, width }: {
  colors: ArtworkPalette;
  height: number;
  phase: SharedValue<number>;
  simplified: boolean;
  width: number;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: shade(colors[0], 0.55) }]}>
      {simplified ? (
        <LinearGradient colors={[shade(colors[0], 0.7), shade(colors[1], 0.55), shade(colors[2], 0.45)]} style={StyleSheet.absoluteFill} />
      ) : colors.map((color, index) => (
        <ColorRegion color={color} height={height} index={index} key={index} phase={phase} width={width} />
      ))}
    </View>
  );
});

const ColorRegion = memo(function ColorRegion({ color, height, index, phase, width }: {
  color: string;
  height: number;
  index: number;
  phase: SharedValue<number>;
  width: number;
}) {
  const size = Math.max(width * 1.6, height * 0.9);
  // Cache only a small gradient texture; upscale that soft texture during
  // compositing instead of retaining three full-resolution screen bitmaps.
  const textureSize = 160;
  const animatedStyle = useAnimatedStyle(() => {
    const angle = phase.value * Math.PI * 2 + index * Math.PI * 2 / 3;
    // Distinct overlapping orbits and changing elliptical shapes make the
    // actual color boundaries drift. Integer harmonics meet seamlessly when
    // the repeat wraps, including after pausing and resuming mid-orbit.
    return {
      opacity: 0.9 + Math.sin(angle + index) * 0.1,
      transform: [
        { translateX: (Math.sin(angle) * 0.36 + Math.cos(angle * 2 + index) * 0.07) * width },
        { translateY: (Math.cos(angle + index * 0.8) * 0.25 + Math.sin(angle * 2 - index) * 0.045) * height },
        { scaleX: size / textureSize * (1.04 + Math.sin(angle - index) * 0.22) },
        { scaleY: size / textureSize * (1.08 + Math.cos(angle * 2 + index) * 0.18) },
      ],
    };
  });
  return (
    <Animated.View
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      style={[{
        position: 'absolute',
        width: textureSize,
        height: textureSize,
        left: width * [0.28, 0.8, 0.35][index] - textureSize / 2,
        top: height * [0.18, 0.54, 0.88][index] - textureSize / 2,
      }, animatedStyle]}>
      <Svg height="100%" viewBox="0 0 100 100" width="100%">
        <Defs>
          <RadialGradient cx="50%" cy="50%" id={`cover-color-${index}`} rx="50%" ry="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.96} />
            <Stop offset="38%" stopColor={color} stopOpacity={0.76} />
            <Stop offset="72%" stopColor={color} stopOpacity={0.26} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect fill={`url(#cover-color-${index})`} height="100" width="100" />
      </Svg>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  // All color layers are absolute, so the container must establish its own
  // bounds. Keep this opaque base outside the palette crossfade as well.
  background: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: '#17171B',
  },
});
