import { useIsFocused, useNavigationContainerRef, useRoute } from 'expo-router';
import { useCallback, useSyncExternalStore } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

import { MainCompactHeader } from '@/components/main-native-header';
import MainHeaderActions from '@/components/main-header-actions';
import MainScreenHeader from '@/components/main-screen-header';
import { usePlayerOverlayPosition, usePlayerOverlayVisible } from '@/providers/player-overlay-visibility-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { isMainHeaderBehindPopup } from '@/services/main-header-visibility';

const expandedHeaderHeight = 80;
const desktopMainTitles = new Set(['Home', 'Library', 'Search']);

export function MainHeaderSpacer({ title }: { title?: string }) {
  const { width } = useWindowDimensions();
  const desktopMainPage = Platform.OS === 'web' && width >= 960 && desktopMainTitles.has(title ?? '');
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={desktopMainPage ? styles.desktopInset : styles.spacer} />;
}

/**
 * The expanded row moves with its reserved content space. On iOS it sits above
 * the UIKit bar so that the bar cannot blur it or intercept its action buttons.
 */
export default function MainHeaderOverlay({ title, offset, horizontalInset = 20, compact = true }: {
  title: string;
  offset: SharedValue<number>;
  horizontalInset?: number;
  compact?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const route = useRoute();
  const navigation = useNavigationContainerRef();
  // Expo's useRootNavigationState reads a shallow navigator snapshot. The
  // container hydrates nested tab/page states and notifies after blur commits.
  const subscribe = useCallback((changed: () => void) => navigation.addListener('state', changed), [navigation]);
  const getCovered = useCallback(() => isMainHeaderBehindPopup(
    navigation.isReady() ? navigation.getRootState() : undefined, route.key, Platform.OS === 'web',
  ), [navigation, route.key]);
  const coveredByPopup = useSyncExternalStore(subscribe, getCovered, () => false);
  const playerVisible = usePlayerOverlayVisible();
  const playerPosition = usePlayerOverlayPosition();
  const { height, width } = useWindowDimensions();
  const { performanceMode } = useAppSettings();
  const active = !compact || focused;
  const behindPopup = compact && !focused && coveredByPopup;
  const sceneVisible = active || behindPopup;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -offset.value }],
  }));
  // The row is above UIKit in a window overlay. Clip it to the area above the
  // player so it is covered progressively, just like the native bar beneath.
  // No React visibility switch or per-frame JS updates are needed during drag.
  const coverageStyle = useAnimatedStyle(() => ({
    height: active ? Math.max(0, Math.min(height, playerPosition?.value ?? height) - insets.top) : 0,
  }));
  const sceneCoverageStyle = useAnimatedStyle(() => ({
    height: sceneVisible ? Math.max(0, Math.min(height, playerPosition?.value ?? height) - insets.top) : 0,
  }));
  if (Platform.OS === 'web' && width >= 960 && desktopMainTitles.has(title)) return null;
  // Keep the window mounted and hide through clipping on navigation/scroll.
  const expandedRow = (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.overlay, { left: Math.max(horizontalInset, insets.left + 12), right: Math.max(horizontalInset, insets.right + 12) }, style]}>
      <MainScreenHeader title={title} offset={offset} trailing={<MainHeaderActions visible={active} offset={offset} />} />
    </Animated.View>
  );
  const windowOverlay = compact && Platform.OS === 'ios';
  return (
    <>
    {windowOverlay ? (
      <FullWindowOverlay unstable_accessibilityContainerViewIsModal={false}>
        <Animated.View
          pointerEvents="box-none"
          accessibilityElementsHidden={!active || playerVisible}
          importantForAccessibility={!active || playerVisible ? 'no-hide-descendants' : 'auto'}
          style={[styles.windowClip, { top: insets.top }, coverageStyle]}>
          {expandedRow}
        </Animated.View>
      </FullWindowOverlay>
    ) : (
      <Animated.View pointerEvents={active ? 'box-none' : 'none'} accessibilityElementsHidden={!active || playerVisible}
        importantForAccessibility={!active || playerVisible ? 'no-hide-descendants' : 'auto'}
        style={[styles.windowClip, { top: insets.top }, sceneCoverageStyle]}>
        {expandedRow}
      </Animated.View>
    )}
    {/* A sheet blurs its source route, but that page remains visible. Render its
        header inside the scene so UIKit can dim/cover it, never above the sheet. */}
    {windowOverlay && behindPopup ? <Animated.View testID="main-header-popup-background" pointerEvents="none"
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.windowClip, { top: insets.top }, sceneCoverageStyle]}>{expandedRow}</Animated.View> : null}
    {sceneVisible && compact && (performanceMode || Platform.OS !== 'ios') ? <MainCompactHeader title={title} offset={offset} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  windowClip: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  overlay: { position: 'absolute', top: 0, height: expandedHeaderHeight },
  spacer: { height: expandedHeaderHeight },
  desktopInset: { height: 24 },
});
