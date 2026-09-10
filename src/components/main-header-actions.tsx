import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAuth } from '@/providers/auth-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { useDetailRoutes } from '@/services/action-sheet';
import { getNotificationUnreadCount, loadNotificationsPage, subscribeNotificationUnreadCount } from '@/services/notifications';
import { expandedHeaderOpacity } from '@/services/main-header-transition';

export default function MainHeaderActions({ visible = true, offset }: { visible?: boolean; offset?: SharedValue<number> }) {
  const router = useRouter();
  const { historyHref, notificationsHref } = useDetailRoutes();
  const { user } = useAuth();
  const { colors, dataSaver } = useAppSettings();
  const uid = user?.uid;
  const unreadCount = useSyncExternalStore(subscribeNotificationUnreadCount, () => getNotificationUnreadCount(uid), () => 0);
  const [materialVisible, setMaterialVisible] = useState(false);
  useAnimatedReaction(
    () => visible && (!offset || expandedHeaderOpacity(offset.value) > 0),
    (next, previous) => {
      if (next !== previous) scheduleOnRN(setMaterialVisible, next);
    },
    [visible, offset],
  );

  useFocusEffect(useCallback(() => {
    // One shared, cached fetch on focus, never a timer or a fetch per header render.
    if (uid) void loadNotificationsPage(uid, null, { dataSaver }).catch(() => undefined);
  }, [dataSaver, uid]));

  const accessibilityLabel = unreadCount > 0 ? `Notifications, ${unreadCount} unread in Audius` : 'Open notifications';
  const icon = (
    <View style={styles.icon}>
      <SymbolView name="bell" size={21} tintColor={colors.text} weight="semibold" />
      {unreadCount > 0 && <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.background }]} />}
    </View>
  );
  const historyIcon = <SymbolView name="clock.arrow.circlepath" size={19} tintColor={colors.text} weight="semibold" />;
  return (
    <View style={styles.actions}>
      <HeaderGlassButton
        accessibilityLabel="Open listening history"
        materialVisible={visible && materialVisible}
        offset={offset}
        onPress={() => router.push(historyHref())}>
        {historyIcon}
      </HeaderGlassButton>
      <HeaderGlassButton
        accessibilityLabel={accessibilityLabel}
        materialVisible={visible && materialVisible}
        offset={offset}
        onPress={() => router.push(notificationsHref())}>
        {icon}
      </HeaderGlassButton>
    </View>
  );
}

/** The two navigation actions retain native glass; ordinary controls stay separate. */
function HeaderGlassButton({ accessibilityLabel, children, materialVisible, offset, onPress }: {
  accessibilityLabel: string;
  children: ReactNode;
  materialVisible: boolean;
  offset?: SharedValue<number>;
  onPress: () => void;
}) {
  const { colors, isDark, performanceMode, reduceMotion } = useAppSettings();
  const [laidOut, setLaidOut] = useState(false);
  const glassAvailable = !performanceMode && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const contentOpacity = useAnimatedStyle(() => ({ opacity: offset ? expandedHeaderOpacity(offset.value) : 1 }));
  // none -> regular creates a fresh effect after layout/on return. Keep glass
  // ancestors opaque; only the glyphs fade with scrolling.
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && !reduceMotion && styles.pressed]}>
      {glassAvailable ? (
        <GlassView
          pointerEvents="none"
          colorScheme={isDark ? 'dark' : 'light'}
          onLayout={() => setLaidOut(true)}
          glassEffectStyle={laidOut && materialVisible ? 'regular' : 'none'}
          isInteractive
          style={[StyleSheet.absoluteFill, styles.circle]}
        />
      ) : (
        <View pointerEvents="none" style={[
          StyleSheet.absoluteFill,
          styles.circle,
          styles.fallback,
          { backgroundColor: colors.elevated, borderColor: colors.border },
        ]} />
      )}
      <Animated.View pointerEvents="none" style={[styles.content, contentOpacity]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  button: { width: 40, height: 40, borderRadius: 20 },
  circle: { borderRadius: 20 },
  fallback: { borderWidth: StyleSheet.hairlineWidth },
  pressed: { transform: [{ scale: 0.97 }] },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
});
