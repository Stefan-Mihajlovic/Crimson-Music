import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

/** Fade only where an edge passes through either copy of the looping title. */
function clippedAmount(edge: number, start: number, end: number, fadeWidth: number) {
  'worklet';
  return Math.max(0, Math.min(1, Math.min(edge - start, end - edge) / fadeWidth));
}

export default function MarqueeMask({ children, offset, textWidth, viewportWidth, repeatGap }: {
  children: ReactNode;
  offset: SharedValue<number>;
  textWidth: number;
  viewportWidth: number;
  repeatGap: number;
}) {
  const overflows = viewportWidth > 0 && textWidth > viewportWidth + 1;
  const fadeWidth = Math.max(1, Math.min(18, viewportWidth / 4));
  const web = Platform.OS === 'web';
  const fades = useDerivedValue(() => {
    if (!overflows) return { left: 0, right: 0 };
    const start = offset.get();
    const nextStart = start + textWidth + repeatGap;
    return {
      left: Math.max(
        clippedAmount(0, start, start + textWidth, fadeWidth),
        clippedAmount(0, nextStart, nextStart + textWidth, fadeWidth),
      ),
      right: Math.max(
        clippedAmount(viewportWidth, start, start + textWidth, fadeWidth),
        clippedAmount(viewportWidth, nextStart, nextStart + textWidth, fadeWidth),
      ),
    };
  });
  const leftCover = useAnimatedStyle(() => ({ opacity: 1 - fades.get().left }));
  const rightCover = useAnimatedStyle(() => ({ opacity: 1 - fades.get().right }));
  const webMask = useAnimatedStyle(() => {
    if (!web) return {};
    const { left, right } = fades.get();
    const gradient = `linear-gradient(to right, rgba(0,0,0,${1 - left}), #000 ${fadeWidth}px, #000 calc(100% - ${fadeWidth}px), rgba(0,0,0,${1 - right}))`;
    return { maskImage: gradient, WebkitMaskImage: gradient } as ViewStyle;
  });

  if (!overflows) return <View>{children}</View>;
  // MaskedView's web fallback does not mask its content; use CSS alpha masking.
  if (web) return <Animated.View style={webMask}>{children}</Animated.View>;

  return (
    <MaskedView
      androidRenderingMode="software"
      maskElement={
        <View style={styles.mask}>
          <View style={{ width: fadeWidth }}>
            <LinearGradient colors={['transparent', '#000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Animated.View style={[styles.opaqueCover, leftCover]} />
          </View>
          <View style={styles.center} />
          <View style={{ width: fadeWidth }}>
            <LinearGradient colors={['#000', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Animated.View style={[styles.opaqueCover, rightCover]} />
          </View>
        </View>
      }>
      {children}
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  mask: { flex: 1, flexDirection: 'row' },
  center: { flex: 1, backgroundColor: '#000' },
  opaqueCover: { position: 'absolute', inset: 0, backgroundColor: '#000' },
});
