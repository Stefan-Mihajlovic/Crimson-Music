import { Image, type ImageSource } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, AppState, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAppSettings } from '@/providers/settings-provider';
import { getWelcomeArtwork } from '@/services/welcome-artwork';

// Bundled covers keep the moving wall complete before Audius artwork arrives,
// and when the welcome screen is opened without a connection.
const fallbackCovers: ImageSource[] = [
  require('@/assets/images/categories/electronic.jpg'),
  require('@/assets/images/categories/ambient.jpg'),
  require('@/assets/images/discovery/underground.jpg'),
  require('@/assets/images/categories/pop.jpg'),
  require('@/assets/images/categories/rock.jpg'),
  require('@/assets/images/discovery/feeling-lucky.jpg'),
  require('@/assets/images/categories/r-b-soul.jpg'),
  require('@/assets/images/categories/jazz.jpg'),
  require('@/assets/images/categories/hip-hop-rap.jpg'),
  require('@/assets/images/discovery/most-shared.jpg'),
  require('@/assets/images/categories/classical.jpg'),
  require('@/assets/images/categories/reggae.jpg'),
];

export default function WelcomeArtworkGrid() {
  const { width, height } = useWindowDimensions();
  const { dataSaver, performanceMode, reduceMotion } = useAppSettings();
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [artwork, setArtwork] = useState<string[]>([]);
  const moving = focused && appActive && !performanceMode && !reduceMotion;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!focused) return;
    const controller = new AbortController();
    void getWelcomeArtwork({ dataSaver, signal: controller.signal }).then((images) => {
      if (!controller.signal.aborted && images.length) setArtwork(images);
    });
    return () => controller.abort();
  }, [dataSaver, focused]);

  const tileSize = Math.max(140, Math.min(210, width * 0.42), Math.max(width, height) / 8);
  const stride = tileSize + 12;
  // Overscan accounts for the rotated corners on both portrait and wide screens.
  const planeHeight = height + width * 0.25 + stride * 2;
  const columnCount = Math.ceil((width + height * 0.25 + stride * 2) / stride);
  const rowCount = Math.max(5, Math.ceil(planeHeight / stride));
  const planeWidth = columnCount * stride;
  const sources: ImageSource[] = artwork.length ? artwork.map((uri) => ({ uri })) : fallbackCovers;

  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={StyleSheet.absoluteFill}>
      <View style={[styles.plane, { width: planeWidth, height: planeHeight, left: (width - planeWidth) / 2, top: (height - planeHeight) / 2 }]}>
        {Array.from({ length: columnCount }, (_, column) => (
          <ArtworkColumn
            key={column}
            column={column}
            moving={moving}
            transition={reduceMotion || performanceMode ? 0 : 350}
            size={tileSize}
            sources={Array.from({ length: rowCount }, (_, row) => sources[(column * 5 + row) % sources.length])}
          />
        ))}
      </View>
    </View>
  );
}

function ArtworkColumn({ column, moving, size, sources, transition }: { column: number; moving: boolean; size: number; sources: ImageSource[]; transition: number }) {
  const [progress] = useState(() => new Animated.Value(0));
  const loopHeight = sources.length * (size + 12);
  const reverse = column % 2 === 1;
  useEffect(() => {
    if (!moving) return;
    progress.setValue(0);
    const animation = Animated.loop(Animated.timing(progress, {
      toValue: 1,
      duration: loopHeight / (column % 2 ? 14 : 18) * 1000,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    }));
    animation.start();
    return () => animation.stop();
  }, [column, loopHeight, moving, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: reverse ? [-loopHeight, 0] : [0, -loopHeight] });
  return (
    <Animated.View style={{ width: size, marginRight: 12, transform: [{ translateY }] }}>
      {/* Identical consecutive sets make the reset from the end to the start invisible. */}
      {[...sources, ...sources].map((source, index) => (
        <Image key={index} source={source} contentFit="cover" transition={transition} cachePolicy="memory-disk" style={[styles.cover, { width: size, height: size }]} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  plane: { position: 'absolute', flexDirection: 'row', transform: [{ rotate: '-12deg' }] },
  cover: { marginBottom: 12, borderRadius: 12, backgroundColor: '#241731', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)' },
});
