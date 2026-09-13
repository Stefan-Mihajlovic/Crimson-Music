import { BrandAccent } from '@/constants/brand-accent';
import ArtworkImage from '@/components/artwork-image';
import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { usePlayer, usePlayerSpectrum, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { CrimsonSong } from '@/services/music';
import { PAUSED_SPECTRUM as pausedBars } from '@/services/playback-spectrum';

const fallbackArtwork = require('@/assets/images/home/default-song.webp');

function PlaybackSpectrum({ size }: { size: number }) {
  const levels = usePlayerSpectrum();
  const status = usePlayerStatus();
  const { performanceMode, reduceMotion } = useAppSettings();
  const [bars] = useState(() => pausedBars.map((value) => new Animated.Value(value)));
  const playing = status.playing && !status.isBuffering;

  useEffect(() => {
    const animation = Animated.parallel(bars.map((bar, index) => Animated.timing(bar, {
      // The analyzer already applies fast attack/short decay; this only bridges
      // sampling frames so drum transients aren't smoothed a second time.
      duration: performanceMode || reduceMotion ? 0 : playing ? 35 : 120,
      toValue: playing && !performanceMode && !reduceMotion ? levels[index] : pausedBars[index],
      useNativeDriver: Platform.OS !== 'web',
    })));
    animation.start();
    return () => animation.stop();
  }, [bars, levels, performanceMode, playing, reduceMotion]);

  const spectrumHeight = Math.max(16, Math.round(size * 0.54));
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
              width: Math.max(2.5, Math.round(size * 0.065)),
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
  song: Pick<CrimsonSong, 'id' | 'image' | 'imageSmall' | 'title'> & { artwork?: CrimsonSong['artwork'] };
}) {
  const { currentSong } = usePlayer();
  const active = currentSong?.id === song.id;
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
    shadowOpacity: 0.9,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
});
