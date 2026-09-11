/* eslint-disable react-hooks/immutability */

import { useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { cancelAnimation, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import DraggablePlayerSurface from '@/components/draggable-player-surface';
import PerformanceTabs from '@/components/performance-tabs';
import { useAccountTabIcon } from '@/hooks/use-account-tab-icon';
import { MINI_PLAYER_HEIGHT } from '@/components/player-layout';
import { requestSearchFocus, subscribeToPlayerCollapse } from '@/services/navigation-events';
import { AppRouteGroup } from '@/services/action-sheet';
import { useAppSettings } from '@/providers/settings-provider';
import { PlayerOverlayVisibilityProvider } from '@/providers/player-overlay-visibility-provider';

export default function AppTabs() {
  const segments = useSegments();
  const accountIcon = useAccountTabIcon();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, isDark, performanceMode, reduceMotion } = useAppSettings();
  const miniBottom = insets.bottom + 55;
  const defaultCollapsedTop = Math.max(1, height - miniBottom - MINI_PLAYER_HEIGHT);
  const collapsedTopRef = useRef(defaultCollapsedTop);
  const playerPosition = useSharedValue(defaultCollapsedTop);
  const collapsedTop = defaultCollapsedTop;
  const [expanded, setExpanded] = useState(false);
  const routeGroup = segments.find((segment) => ['(home)', '(search)', '(library)', '(account)'].includes(segment)) as AppRouteGroup | undefined;
  useEffect(() => {
    collapsedTopRef.current = collapsedTop;
    if (!expanded) playerPosition.value = collapsedTop;
  }, [collapsedTop, expanded, playerPosition]);

  const prepareSurface = useCallback(() => {
    cancelAnimation(playerPosition);
    setExpanded(true);
  }, [playerPosition]);

  const animatePlayerTo = useCallback((
    toValue: number,
    velocity = 0,
    allowBounce = false,
    onFinished?: () => void,
  ) => {
    cancelAnimation(playerPosition);
    if (reduceMotion) {
      playerPosition.value = toValue;
      onFinished?.();
      return;
    }

    const clampedVelocity = Math.max(-1800, Math.min(1800, velocity));
    // Closing retains a little velocity-sensitive elasticity; opening is
    // critically damped and clamps at fullscreen without crossing the target.
    const velocityStrength = Math.min(1, Math.abs(clampedVelocity) / 1800);
    playerPosition.value = withSpring(toValue, {
      damping: allowBounce ? 23.5 - velocityStrength * 2 : 26.5,
      mass: 0.9,
      stiffness: 190,
      velocity: clampedVelocity,
      overshootClamping: !allowBounce,
      energyThreshold: 1e-6,
    }, (finished) => {
      if (finished && onFinished) scheduleOnRN(onFinished);
    });
  }, [playerPosition, reduceMotion]);

  const expand = useCallback((velocity = -460) => {
    prepareSurface();
    animatePlayerTo(0, Math.min(0, velocity), false);
  }, [animatePlayerTo, prepareSurface]);

  const collapse = useCallback((velocity = 300) => {
    animatePlayerTo(collapsedTopRef.current, Math.max(0, velocity), true, () => setExpanded(false));
  }, [animatePlayerTo]);

  useEffect(() => subscribeToPlayerCollapse(collapse), [collapse]);

  const handleSearchTap = () => {
    if (routeGroup === '(search)') requestSearchFocus();
  };

  return (
    <PlayerOverlayVisibilityProvider visible={expanded} position={playerPosition}>
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <NativeTabs
        hidden={performanceMode}
        backgroundColor={isDark ? 'rgba(17,14,23,0.86)' : 'rgba(255,255,255,0.82)'}
        blurEffect={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        disableTransparentOnScrollEdge
        minimizeBehavior="never"
        tintColor={colors.accent}
        iconColor={{ default: colors.secondaryText, selected: colors.accent }}
        labelStyle={{
          default: { color: colors.secondaryText, fontSize: 11, fontWeight: '600' },
          selected: { color: colors.accent, fontSize: 11, fontWeight: '700' },
        }}>
        <NativeTabs.Trigger name="(home)" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'house', selected: 'house.fill' }}
            md={{ default: 'home', selected: 'home' }}
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger
          name="(search)"
          disableAutomaticContentInsets
          role="search"
          listeners={{ tabPress: handleSearchTap }}>
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf="magnifyingglass"
            md="search"
          />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="(library)" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'folder', selected: 'folder.fill' }}
            md={{ default: 'folder', selected: 'folder' }}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="(account)" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon src={accountIcon} renderingMode="original" />
        </NativeTabs.Trigger>
      </NativeTabs>
      {performanceMode ? <PerformanceTabs /> : null}
      <DraggablePlayerSurface
        collapsedTop={collapsedTop}
        expanded={expanded}
        height={height}
        onBeginExpand={prepareSurface}
        onCollapse={collapse}
        onExpand={expand}
        position={playerPosition}
      />
    </View>
    </PlayerOverlayVisibilityProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E0D13' },
});
