import { FrostedBackdrop } from '@/components/frosted-surface';
import { Stack } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSettings } from '@/providers/settings-provider';
import { compactHeaderProgress } from '@/services/main-header-transition';

/** UIKit owns the compact bar and its scroll-edge material throughout scrolling. */
export default function MainNativeHeader({
  title,
  offset,
  preview = false,
}: { title: string; offset: SharedValue<number>; preview?: boolean }) {
  const { performanceMode } = useAppSettings();
  if (preview) return null;
  const nativeHeader = Platform.OS === 'ios' && !performanceMode;
  return (
    <Stack.Screen options={{
      title,
      headerShown: nativeHeader,
      headerLargeTitleEnabled: false,
      headerTransparent: true,
      headerStyle: { backgroundColor: 'transparent' },
      headerBlurEffect: 'none',
      headerShadowVisible: false,
      headerTitle: () => <MainCompactTitle offset={offset} title={title} />,
      scrollEdgeEffects: { top: nativeHeader ? 'soft' : 'hidden', bottom: 'hidden' },
    }} />
  );
}

/** Only the title fades on the UI thread; the real native bar is never remounted. */
export function MainCompactTitle({ offset, title }: { offset: SharedValue<number>; title: string }) {
  const { colors } = useAppSettings();
  const style = useAnimatedStyle(() => ({ opacity: compactHeaderProgress(offset.value) }));
  return (
    <Animated.View pointerEvents="none" style={style}>
      <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title}</Text>
    </Animated.View>
  );
}

/** Solid fallback for Performance Mode and platforms without the UIKit bar. */
export function MainCompactHeader({ offset, title }: { offset: SharedValue<number>; title: string }) {
  const { colors, performanceMode } = useAppSettings();
  const insets = useSafeAreaInsets();
  const style = useAnimatedStyle(() => ({ opacity: compactHeaderProgress(offset.value) }));
  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { height: insets.top + 44, backgroundColor: performanceMode ? colors.background : 'transparent' }, style]}>
      {!performanceMode ? <FrostedBackdrop radius={0} solidColor={colors.background} /> : null}
      <View style={[styles.bar, { marginTop: insets.top }]}>
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  title: { fontSize: 19, lineHeight: 24, fontWeight: '600' },
  bar: { height: 44, alignItems: 'center', justifyContent: 'center' },
});
