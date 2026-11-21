import { BrandAccent } from '@/constants/brand-accent';
import ArtworkImage from '@/components/artwork-image';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { usePlayer, usePlayerSpectrumStore } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { CrimsonSong } from '@/services/music';
import { PAUSED_SPECTRUM as pausedBars } from '@/services/playback-spectrum';

const fallbackArtwork = require('@/assets/images/home/default-song.webp');

function PlaybackSpectrum({ size }: { size: number }) {
  const store = usePlayerSpectrumStore();
  const { performanceMode, reduceMotion } = useAppSettings();
  const levels = useSharedValue([...pausedBars]);
  useEffect(() => {
    if (performanceMode || reduceMotion) { levels.set([...pausedBars]); return; }
    const update = () => { levels.set(withTiming([...store.getSnapshot()], { duration: 35 })); };
    const unsubscribe = store.subscribe(update);
    update();
    return () => { unsubscribe(); cancelAnimation(levels); };
  }, [levels, performanceMode, reduceMotion, store]);
  return <View pointerEvents="none" style={[styles.spectrum, { gap: Math.max(2, Math.round(size * 0.045)) }]}>
    {pausedBars.map((_, index) => <SpectrumBar key={index} levels={levels} index={index} size={size} />)}
  </View>;
}
const SpectrumBar = memo(function SpectrumBar({ levels, index, size }: { levels: SharedValue<number[]>; index: number; size: number }) {
  const animated = useAnimatedStyle(() => ({ transform: [{ scaleY: levels.value[index] }] }));
  return <Animated.View style={[styles.bar, { height: Math.max(16, Math.round(size * 0.54)), width: Math.max(2.5, Math.round(size * 0.065)) }, animated]} />;
});

export function NowPlayingOverlay({
  active,
  spectrumSize = 50,
}: {
  active: boolean;
  spectrumSize?: number;
}) {
  if (!active) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.dimmer} />
      <PlaybackSpectrum size={spectrumSize} />
    </View>
  );
}

export function CollectionPlayingOverlay({
  sourceName,
  spectrumSize,
}: {
  sourceName: string;
  spectrumSize?: number;
}) {
  const { currentSong, source } = usePlayer();
  return (
    <NowPlayingOverlay
      active={Boolean(currentSong && sourceName && source === sourceName)}
      spectrumSize={spectrumSize}
    />
  );
}

export default function NowPlayingArtwork({
  borderRadius = 10,
  active: activeOverride,
  size,
  song,
}: {
  borderRadius?: number;
  active?: boolean;
  size: number;
  song: Pick<CrimsonSong, 'id' | 'image' | 'imageSmall' | 'title'> & { artwork?: CrimsonSong['artwork'] };
}) {
  const { currentSong } = usePlayer();
  const active = activeOverride ?? currentSong?.id === song.id;
  const image = song.imageSmall || song.image;

  return (
    <View style={[styles.artwork, { width: size, height: size, borderRadius }]}>
      <ArtworkImage
        artwork={song.artwork}
        fallbackSource={fallbackArtwork}
        cachePolicy="memory-disk"
        contentFit="cover"
        recyclingKey={song.id}
        source={image ? { uri: image } : fallbackArtwork}
        style={StyleSheet.absoluteFill}
      />
      <NowPlayingOverlay active={active} spectrumSize={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: {
    position: 'relative',
    flexShrink: 0,
    overflow: 'hidden',
    backgroundColor: '#211C28',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
  },
  dimmer: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(8,5,13,0.42)',
  },
  spectrum: {
    position: 'absolute',
    inset: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    borderRadius: 99,
    backgroundColor: '#F4EBFF',
    shadowColor: BrandAccent.dark,
    shadowOpacity: 0,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
});
