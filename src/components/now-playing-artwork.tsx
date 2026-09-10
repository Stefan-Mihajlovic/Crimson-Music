import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { usePlayer, usePlayerSpectrum, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { CrimsonSong } from '@/services/music';

const fallbackArtwork = require('@/assets/images/home/default-song.webp');
const pausedBars = [0.36, 0.36, 0.36, 0.36];

function PlaybackSpectrum({ size }: { size: number }) {
  const levels = usePlayerSpectrum();
  const status = usePlayerStatus();
  const { performanceMode, reduceMotion } = useAppSettings();
  const [bars] = useState(() => pausedBars.map((value) => new Animated.Value(value)));
  const playing = status.playing && !status.isBuffering;

  useEffect(() => {
    bars.forEach((bar) => bar.stopAnimation());
    Animated.parallel(bars.map((bar, index) => Animated.timing(bar, {
      duration: performanceMode || reduceMotion ? 0 : playing ? 65 : 160,
      toValue: playing && !performanceMode && !reduceMotion ? levels[index] : pausedBars[index],
      useNativeDriver: true,
    }))).start();
  }, [bars, levels, performanceMode, playing, reduceMotion]);

  const spectrumHeight = Math.max(13, Math.round(size * 0.42));
  return (
    <View
      pointerEvents="none"
      style={[styles.spectrum, { gap: Math.max(2, Math.round(size * 0.045)) }]}>
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            performanceMode && { shadowOpacity: 0 },
            {
              height: spectrumHeight,
              width: Math.max(2, Math.round(size * 0.055)),
              transform: [{ scaleY: bar }],
            },
          ]}
        />
      ))}
    </View>
  );
}

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
  size,
  song,
}: {
  borderRadius?: number;
  size: number;
  song: Pick<CrimsonSong, 'id' | 'image' | 'imageSmall' | 'title'>;
}) {
  const { currentSong } = usePlayer();
  const active = currentSong?.id === song.id;
  const image = song.imageSmall || song.image;

  return (
    <View style={[styles.artwork, { width: size, height: size, borderRadius }]}>
      <Image
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
    shadowColor: '#B981FF',
    shadowOpacity: 0.9,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
});
