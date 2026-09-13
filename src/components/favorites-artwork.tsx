import { Image, type ImageProps } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, AppState, Easing, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppSettings } from '@/providers/settings-provider';

const heartArtwork = require('@/assets/images/favorites/heart.webp');
const stillArtwork = require('@/assets/images/favorites/heart-still.webp');

type FavoritesArtworkProps = Omit<ImageProps, 'source' | 'autoplay' | 'style'> & {
  style?: StyleProp<ViewStyle>;
  variant?: 'thumbnail' | 'hero';
};

/** One Favorites identity across the header, library, shortcuts and web sidebar. */
export default function FavoritesArtwork({ style, variant = 'thumbnail', ...props }: FavoritesArtworkProps) {
  const { reduceMotion, performanceMode } = useAppSettings();
  const animated = !reduceMotion && !performanceMode;
  return (
    <View style={[style, styles.clip]}>
      {variant === 'hero' ? <HeroHeart {...props} animated={animated} /> : (
        <Image contentFit="cover" {...props} source={animated ? heartArtwork : stillArtwork}
          autoplay={animated} style={styles.thumbnail} />
      )}
    </View>
  );
}

function HeroHeart({ animated, ...props }: Omit<FavoritesArtworkProps, 'style' | 'variant'> & { animated: boolean }) {
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    pulse.setValue(0);
    if (!animated || !focused || !appActive) return;
    const timing = (toValue: number) => Animated.timing(pulse, {
      toValue,
      duration: 2200,
      easing: Easing.inOut(Easing.sin),
      isInteraction: false,
      useNativeDriver: Platform.OS !== 'web',
    });
    const animation = Animated.loop(Animated.sequence([timing(1), timing(0)]));
    animation.start();
    return () => animation.stop();
  }, [animated, appActive, focused, pulse]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, {
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }],
    }]}>
      <Image contentFit="cover" {...props} source={stillArtwork} autoplay={false} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  // The source heart sits at ~42% height to leave room for hero copy. A top-aligned
  // 120% crop brings its center to 50% in square thumbnails without an empty edge.
  thumbnail: { position: 'absolute', top: 0, left: '-10%', width: '120%', height: '120%' },
});
