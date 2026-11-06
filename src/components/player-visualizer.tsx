import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { usePlayerVisualizerStore } from '@/providers/player-provider';
import type { ArtworkPalette } from '@/services/artwork-palette';
import type { VisualizerArtworkLayout, VisualizerStyle } from '@/services/player-visualizer';
import { IDLE_VISUALIZER_FRAME, VisualizerResponse } from '@/services/visualizer-response';

type Frame = SharedValue<number[]>;
const textureSize = 192;
const bandIndices = Array.from({ length: 16 }, (_, index) => index);
const regionIndices = [0, 1, 2];
const tideIndices = [0, 1, 2, 3];
const prismIndices = Array.from({ length: 8 }, (_, index) => index);

function illuminate(hex: string) {
  const rgb = Number.parseInt(hex.slice(1), 16);
  return `#${[16, 8, 0].map((shift) => Math.round(((rgb >> shift) & 255) * 0.8 + 51).toString(16).padStart(2, '0')).join('')}`;
}

/** Audio publishes at 20 Hz; one shared frame interpolates on the UI thread.
 * React renders only on layout/palette/style changes. All glow is drawn once
 * into small textures, never as a live shadow/blur on a screen-sized ring. */
export default function PlayerVisualizer({ colors, style, width, height, artworkLayout }: {
  colors: ArtworkPalette; style: VisualizerStyle; width: number; height: number; artworkLayout?: VisualizerArtworkLayout;
}) {
  const store = usePlayerVisualizerStore();
  const frame = useSharedValue([...IDLE_VISUALIZER_FRAME]);
  const luminous = useMemo(() => colors.map(illuminate), [colors]);
  const centerX = artworkLayout ? artworkLayout.x + artworkLayout.size / 2 : width / 2;
  const centerY = artworkLayout ? artworkLayout.y + artworkLayout.size / 2 : height * 0.35;
  const coverSize = artworkLayout?.size ?? Math.min(width, height) * 0.85;
  useEffect(() => {
    const response = new VisualizerResponse();
    const update = () => {
      const next = response.next(store.getSnapshot());
      // The provider publishes silence on pause, buffering, track changes and
      // backgrounding. No timers or status-driven React renders are needed.
      frame.set(withTiming(next, { duration: next.some(Boolean) ? 45 : 150, easing: Easing.linear }));
    };
    const unsubscribe = store.subscribe(update);
    update();
    return () => { unsubscribe(); cancelAnimation(frame); };
  }, [frame, store]);

  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    testID={`player-visualizer-${style}`} style={[StyleSheet.absoluteFill, styles.base]}>
    <LinearGradient colors={[`${colors[0]}66`, '#090711', `${colors[2]}44`]} style={StyleSheet.absoluteFill} />
    {style === 'aurora' ? regionIndices.map((index) => <AuroraRegion key={index} frame={frame} color={luminous[index]} index={index} width={width} height={height} />) : null}
    {style === 'spectrum' ? <View style={[styles.spectrum, { height: height * 0.62 }]}>
      {bandIndices.map((index) => <SpectrumBar key={index} frame={frame} index={index} color={luminous[Math.floor(index / 6) % 3]} />)}
    </View> : null}
    {style === 'orbit' ? regionIndices.map((index) => <OrbitRing key={index} frame={frame} color={luminous[index]} index={index} centerX={centerX} centerY={centerY} coverSize={coverSize} />) : null}
    {style === 'tides' ? tideIndices.map((index) => <TideWave key={index} frame={frame} color={luminous[index % 3]} index={index} width={width} height={height} />) : null}
    {style === 'prism' ? prismIndices.map((index) => <PrismBeam key={index} frame={frame} color={luminous[index % 3]} index={index} centerX={centerX} centerY={centerY} coverSize={coverSize} />) : null}
  </View>;
}

const SpectrumBar = memo(function SpectrumBar({ frame, index, color }: { frame: Frame; index: number; color: string }) {
  const animated = useAnimatedStyle(() => {
    const energy = frame.value[index];
    return {
      opacity: 0.22 + energy * 0.7,
      transform: [{ scaleY: 0.018 + energy * 0.982 }],
    };
  });
  return <Animated.View style={[styles.bar, animated]}>
    <View style={styles.column}><LinearGradient colors={['#FFFFFFE0', color, `${color}55`]} locations={[0, 0.13, 1]} style={StyleSheet.absoluteFill} /></View>
    <View style={styles.reflection}><LinearGradient colors={[`${color}66`, `${color}00`]} style={StyleSheet.absoluteFill} /></View>
  </Animated.View>;
});

const AuroraRegion = memo(function AuroraRegion({ frame, color, index, width, height }: {
  frame: Frame; color: string; index: number; width: number; height: number;
}) {
  const size = Math.max(width * 1.5, height * 0.7) / textureSize;
  const animated = useAnimatedStyle(() => {
    const bass = frame.value[16], energy = frame.value[16 + index], kick = frame.value[19];
    return {
      opacity: 0.18 + energy * 0.72,
      transform: [
        { translateX: (index === 1 ? -1 : 1) * (energy * width * 0.16 + kick * width * 0.025) },
        { translateY: (index === 2 ? -1 : 1) * (energy - 0.3) * height * 0.12 },
        { rotate: `${[-32, 38, -16][index]}deg` },
        { scaleX: size * (0.7 + energy * 0.65 + kick * 0.08) },
        { scaleY: size * (0.3 + energy * 0.45 + bass * 0.12) },
      ],
    };
  });
  return <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={[{
    position: 'absolute', width: textureSize, height: textureSize,
    left: width * [0.05, 0.95, 0.3][index] - textureSize / 2, top: height * [0.2, 0.45, 0.78][index] - textureSize / 2,
  }, animated]}><Svg viewBox="0 0 100 100" width="100%" height="100%"><Defs><RadialGradient id={`aurora-${index}`}>
    <Stop offset="0" stopColor={color} stopOpacity={1} /><Stop offset="0.32" stopColor={color} stopOpacity={0.8} /><Stop offset="1" stopColor={color} stopOpacity={0} />
  </RadialGradient></Defs><Rect width="100" height="100" fill={`url(#aurora-${index})`} /></Svg></Animated.View>;
});

const OrbitRing = memo(function OrbitRing({ frame, color, index, centerX, centerY, coverSize }: {
  frame: Frame; color: string; index: number; centerX: number; centerY: number; coverSize: number;
}) {
  const size = coverSize * (1.34 + index * 0.36) / textureSize;
  const animated = useAnimatedStyle(() => {
    const energy = frame.value[16 + index], kick = frame.value[19];
    return {
      opacity: 0.22 + energy * 0.68,
      transform: [{ scale: size * (0.9 + energy * 0.24 + kick * 0.045) }],
    };
  });
  return <Animated.View testID={`orbit-ring-${index}`} renderToHardwareTextureAndroid shouldRasterizeIOS style={[{
    position: 'absolute', width: textureSize, height: textureSize,
    left: centerX - textureSize / 2, top: centerY - textureSize / 2,
  }, animated]}>
    <Svg viewBox="0 0 128 128" width="100%" height="100%">
      <Circle cx="64" cy="64" r="55" fill="none" stroke={color} strokeWidth="10" opacity={0.06} />
      <Circle cx="64" cy="64" r="55" fill="none" stroke={color} strokeWidth="5" opacity={0.18} />
      <Circle cx="64" cy="64" r="55" fill="none" stroke={color} strokeWidth="1.4" opacity={0.95} />
      <Circle cx="64" cy="64" r="55" fill="none" stroke="#FFFFFF" strokeWidth="0.4" opacity={0.55} />
    </Svg>
  </Animated.View>;
});

// Fixed SVG textures: only their transform/opacity changes with the shared
// audio frame. No per-frame path generation, blur filters or particle loops.
const TideWave = memo(function TideWave({ frame, color, index, width, height }: {
  frame: Frame; color: string; index: number; width: number; height: number;
}) {
  const animated = useAnimatedStyle(() => {
    const energy = frame.value[16 + index % 3], kick = frame.value[19];
    return {
      opacity: 0.18 + energy * 0.65,
      transform: [
        { translateX: (index % 2 ? -1 : 1) * energy * width * 0.07 },
        { translateY: -(energy + kick * 0.15) * height * 0.065 },
        { scaleX: width * 1.5 / 256 },
        { scaleY: height * 0.25 / 128 * (0.55 + energy * 0.8) },
      ],
    };
  });
  const crest = index % 2
    ? 'M0 63C43 114 85 114 128 63S213 12 256 63'
    : 'M0 63C43 12 85 12 128 63S213 114 256 63';
  return <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={[{
    position: 'absolute', width: 256, height: 128, left: (width - 256) / 2, top: height * (0.46 + index * 0.1) - 64,
  }, animated]}>
    <Svg viewBox="0 0 256 128" width="100%" height="100%"><Defs>
      <SvgLinearGradient id={`tide-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0" stopColor={color} stopOpacity={0.6} /><Stop offset="1" stopColor={color} stopOpacity={0} />
      </SvgLinearGradient>
    </Defs>
      <Path d={`${crest}L256 128H0Z`} fill={`url(#tide-${index})`} />
      <Path d={crest} fill="none" stroke={color} strokeWidth={7} opacity={0.1} />
      <Path d={crest} fill="none" stroke={color} strokeWidth={2} opacity={0.8} />
      <Path d={crest} fill="none" stroke="#FFFFFF" strokeWidth={0.45} opacity={0.65} />
    </Svg>
  </Animated.View>;
});

const PrismBeam = memo(function PrismBeam({ frame, color, index, centerX, centerY, coverSize }: {
  frame: Frame; color: string; index: number; centerX: number; centerY: number; coverSize: number;
}) {
  const reach = coverSize * 1.4 / textureSize;
  const animated = useAnimatedStyle(() => {
    const energy = Math.max(frame.value[index * 2], frame.value[index * 2 + 1]);
    const kick = frame.value[19];
    return {
      opacity: 0.08 + energy * 0.62,
      transform: [
        { rotate: `${index * 45 + (index % 2 ? -1 : 1) * (energy * 12 + kick * 3)}deg` },
        { scaleX: reach * (0.45 + energy * 0.75) },
        { scaleY: reach * (0.8 + energy * 0.25) },
      ],
    };
  });
  return <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={[{
    position: 'absolute', width: textureSize, height: textureSize, left: centerX - textureSize / 2, top: centerY - textureSize,
    transformOrigin: '50% 100%',
  }, animated]}>
    <Svg viewBox="0 0 100 100" width="100%" height="100%"><Defs>
      <SvgLinearGradient id={`prism-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0" stopColor={color} stopOpacity={0} /><Stop offset="0.38" stopColor={color} stopOpacity={0.45} />
        <Stop offset="0.8" stopColor={color} stopOpacity={0.9} /><Stop offset="1" stopColor="#FFFFFF" stopOpacity={1} />
      </SvgLinearGradient>
    </Defs>
      <Path d="M50 100L26 0H74Z" fill={`url(#prism-${index})`} />
      <Path d="M50 100L45 0H55Z" fill={`url(#prism-${index})`} opacity={0.8} />
    </Svg>
  </Animated.View>;
});

const styles = StyleSheet.create({
  base: { overflow: 'hidden', backgroundColor: '#090711' },
  spectrum: { position: 'absolute', bottom: '12%', left: 14, right: 14, flexDirection: 'row', gap: 5 },
  bar: { flex: 1, height: '100%', transformOrigin: '50% 72%' },
  column: { height: '72%', overflow: 'hidden', borderRadius: 99 },
  reflection: { height: '28%', marginTop: 3, overflow: 'hidden', borderRadius: 99 },
});
