import { FrostedLayer } from '@/components/frosted-surface';
/* eslint-disable react-hooks/immutability */

import { useFocusEffect, useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, NativeModules, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { cancelAnimation, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { GestureDetector } from 'react-native-gesture-handler';

import DraggablePlayerSurface from '@/components/draggable-player-surface';
import NativePlayerAccessory, { useNativePlayerGesture, type NativePlayerFrame, type PlayerDestination } from '@/components/native-player-accessory';
import PerformanceTabs from '@/components/performance-tabs';
import { useAccountTabIcon } from '@/hooks/use-account-tab-icon';
import { MINI_PLAYER_HEIGHT } from '@/components/player-layout';
import { requestSearchFocus, subscribeToPlayerCollapse } from '@/services/navigation-events';
import { subscribeToWidgetPlayerPresentation } from '@/services/widget-navigation';
import { AppRouteGroup } from '@/services/action-sheet';
import { useAppSettings } from '@/providers/settings-provider';
import { PlayerOverlayVisibilityProvider } from '@/providers/player-overlay-visibility-provider';
import { usePlayer } from '@/providers/player-provider';

export default function AppTabs() {
  const segments = useSegments();
  const accountIcon = useAccountTabIcon();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, isDark, performanceMode, reduceMotion, theme } = useAppSettings();
  const { currentSong } = usePlayer();
  // Only iPhone adopts the system's collapsing accessory. Keep the existing
  // player/tab layout on iPad, older iOS, Android, and in Performance Mode.
  const nativeAccessory = Platform.OS === 'ios' && !Platform.isPad
    && Number.parseInt(String(Platform.Version), 10) >= 26 && !performanceMode;
  const [nativeFrame, setNativeFrame] = useState<NativePlayerFrame | null>(null);
  const customTabs = performanceMode || Platform.OS === 'android';
  const customTabBottom = Platform.OS === 'android' ? insets.bottom + 8 : Math.max(8, insets.bottom - 8);
  const miniBottom = customTabs ? customTabBottom + 62 + 8 : insets.bottom + 55;
  const defaultCollapsedTop = Math.max(1, height - miniBottom - MINI_PLAYER_HEIGHT);
  const collapsedTopRef = useRef(defaultCollapsedTop);
  const playerPosition = useSharedValue(defaultCollapsedTop);
  const returnProgress = useSharedValue(0);
  const returnFrame = useSharedValue<PlayerDestination | null>(null);
  const stopDestinationTracking = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDestinationTracking.current?.(), []);
  const collapsedTop = nativeAccessory && nativeFrame ? nativeFrame.y : defaultCollapsedTop;
  const [expanded, setExpanded] = useState(false);
  const transitionRevision = useRef(0);
  const routeGroup = segments.find((segment) => ['(home)', '(search)', '(library)', '(account)'].includes(segment)) as AppRouteGroup | undefined;
  useEffect(() => {
    collapsedTopRef.current = collapsedTop;
    if (!expanded) playerPosition.value = collapsedTop;
  }, [collapsedTop, expanded, playerPosition]);

  const prepareSurface = useCallback(() => {
    transitionRevision.current += 1;
    stopDestinationTracking.current?.();
    cancelAnimation(returnFrame);
    cancelAnimation(playerPosition);
    cancelAnimation(returnProgress);
    setExpanded(true);
  }, [playerPosition, returnFrame, returnProgress]);

  const prepareNativeSurface = useCallback((frame: NativePlayerFrame) => {
    transitionRevision.current += 1;
    // Capture the actual regular OR inline accessory before starting the morph.
    // Reading a fixed bottom inset would jump when the native bar is minimized.
    collapsedTopRef.current = frame.y;
    returnProgress.value = 0;
    returnFrame.value = { ...(frame.restingFrame ?? frame), inline: Number(frame.inline) };
    setNativeFrame(frame);
    setExpanded(true);
  }, [returnFrame, returnProgress]);

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
    // Preserve the original opening curve. Only closing uses the more
    // elastic velocity-sensitive spring; its visible overshoot is bounded.
    const nativeClosing = nativeAccessory && toValue > 0;
    const velocityStrength = Math.min(1, Math.abs(clampedVelocity) / 1800);
    playerPosition.value = withSpring(toValue, {
      damping: nativeClosing ? 22.5 - velocityStrength * 3.5 : allowBounce ? 23.5 - velocityStrength * 2 : 26.5,
      mass: nativeClosing ? 1.05 : 0.9,
      stiffness: 190,
      velocity: clampedVelocity,
      overshootClamping: !nativeClosing && !allowBounce,
      energyThreshold: 1e-6,
    }, (finished) => {
      if (finished && onFinished) scheduleOnRN(onFinished);
    });
  }, [nativeAccessory, playerPosition, reduceMotion]);

  const expand = useCallback((velocity = -460) => {
    prepareSurface();
    animatePlayerTo(0, Math.min(0, velocity), false);
  }, [animatePlayerTo, prepareSurface]);

  const collapse = useCallback((velocity = 300) => {
    stopDestinationTracking.current?.();
    const revision = ++transitionRevision.current;
    let geometryFinished = !nativeAccessory || reduceMotion;
    let destinationFinished = true;
    let travelFinished = false;
    let measuring = nativeAccessory && Boolean(NativeModules.CrimsonRemoteControls?.measurePlayerDestination);
    let stopped = false;
    let needsFinalSample = measuring;
    let destinationRevision = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { stopped = true; clearTimeout(timer); };
    stopDestinationTracking.current = stop;
    const finish = () => {
      if (!stopped && revision === transitionRevision.current && geometryFinished && destinationFinished && travelFinished && !measuring) {
        if (needsFinalSample) {
          needsFinalSample = false;
          measuring = true;
          clearTimeout(timer);
          void sampleDestination();
          return;
        }
        stop();
        if (nativeAccessory) NativeModules.CrimsonRemoteControls?.completePlayerTransition?.();
        setExpanded(false);
      }
    };
    const finishGeometry = () => { geometryFinished = true; finish(); };
    // Poll only during settling, with one native request in flight. UIKit owns
    // scroll minimization, so React scroll offsets cannot predict this frame.
    const sampleDestination = async () => {
      try {
        const frame = await NativeModules.CrimsonRemoteControls?.measurePlayerDestination?.();
        if (stopped || revision !== transitionRevision.current) return;
        if (frame && [frame.x, frame.y, frame.width, frame.height].every(Number.isFinite)
          && frame.width > 0 && frame.height > 0) {
          const next = { x: frame.x, y: frame.y, width: frame.width, height: frame.height, inline: Number(frame.inline) };
          const last = destination;
          if (!last || Object.keys(next).some((key) => Math.abs(next[key as keyof PlayerDestination] - last[key as keyof PlayerDestination]) > 0.5)) {
            destination = next;
            needsFinalSample = true;
            const targetRevision = ++destinationRevision;
            const finishDestination = () => {
              if (targetRevision !== destinationRevision) return;
              destinationFinished = true;
              finish();
            };
            destinationFinished = reduceMotion;
            returnFrame.value = reduceMotion ? next : withTiming(next, { duration: 180 }, (finished) => {
              if (finished) scheduleOnRN(finishDestination);
            });
          }
        }
      } catch { /* Keep the measured opening frame on older native builds. */ }
      finally {
        measuring = false;
        if (!stopped && revision === transitionRevision.current) {
          finish();
          if (!stopped && !measuring) timer = setTimeout(() => { measuring = true; void sampleDestination(); }, 50);
        }
      }
    };
    let destination = returnFrame.value;
    if (nativeAccessory) returnProgress.value = reduceMotion ? 1 : withTiming(1, { duration: 280 }, (finished) => {
      if (finished) scheduleOnRN(finishGeometry);
    });
    if (measuring) void sampleDestination();
    animatePlayerTo(collapsedTopRef.current, Math.max(0, velocity), !nativeAccessory, () => {
      travelFinished = true;
      finish();
    });
  }, [animatePlayerTo, nativeAccessory, reduceMotion, returnFrame, returnProgress]);
  const { gesture: nativeGesture, regularRef, inlineRef, onSurfaceReady, open: openNativePlayer } = useNativePlayerGesture({
    enabled: nativeAccessory && Boolean(currentSong), expanded, position: playerPosition,
    onBeginExpand: prepareNativeSurface, onExpand: expand, onCollapse: collapse,
  });

  useEffect(() => subscribeToPlayerCollapse(collapse), [collapse]);
  useEffect(() => subscribeToWidgetPlayerPresentation((visible) => visible ? expand() : collapse()), [collapse, expand]);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android' || !expanded) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      collapse();
      return true;
    });
    return () => subscription.remove();
  }, [collapse, expanded]));

  const handleSearchTap = () => {
    if (routeGroup === '(search)') requestSearchFocus();
  };

  return (
    <PlayerOverlayVisibilityProvider visible={expanded} position={playerPosition}>
    <GestureDetector gesture={nativeGesture}>
    <View collapsable={false} style={[styles.screen, { backgroundColor: colors.background }]}>
      <FrostedLayer style={styles.screen} background={<NativeTabs
        hidden={customTabs}
        unstable_nativeProps={{
          colorScheme: theme === 'Auto' ? 'inherit' : isDark ? 'dark' : 'light',
          // Remove UIKit's complete accessory during the morph. Its opening
          // gesture lives on the stable host above, so it keeps tracking.
          ios: { bottomAccessoryHidden: nativeAccessory && expanded },
        }}
        backgroundColor={isDark ? 'rgba(17,14,23,0.86)' : 'rgba(255,255,255,0.82)'}
        blurEffect={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        disableTransparentOnScrollEdge
        minimizeBehavior={nativeAccessory && !reduceMotion ? 'onScrollDown' : 'never'}
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

        {!nativeAccessory ? <NativeTabs.Trigger
          name="(search)"
          disableAutomaticContentInsets
          role="search"
          listeners={{ tabPress: handleSearchTap }}>
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf="magnifyingglass"
            md="search"
          />
        </NativeTabs.Trigger> : null}

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
        {nativeAccessory ? <NativeTabs.Trigger name="(search)" disableAutomaticContentInsets role="search"
          listeners={{ tabPress: handleSearchTap }}>
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        </NativeTabs.Trigger> : null}
        {nativeAccessory && currentSong ? <NativeTabs.BottomAccessory>
          <NativePlayerAccessory expanded={expanded} onOpen={openNativePlayer}
            regularRef={regularRef} inlineRef={inlineRef} />
        </NativeTabs.BottomAccessory> : null}
      </NativeTabs>}>
      {customTabs ? <PerformanceTabs bottom={customTabBottom} /> : null}
      <DraggablePlayerSurface
        collapsedTop={collapsedTop}
        expanded={expanded}
        height={height}
        nativeAccessory={nativeAccessory}
        nativeFrame={nativeAccessory ? nativeFrame : null}
        returnProgress={returnProgress}
        returnFrame={returnFrame}
        onBeginExpand={prepareSurface}
        onSurfaceReady={nativeAccessory ? onSurfaceReady : undefined}
        onCollapse={collapse}
        onExpand={expand}
        position={playerPosition}
      />
      </FrostedLayer>
    </View>
    </GestureDetector>
    </PlayerOverlayVisibilityProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E0D13' },
});
