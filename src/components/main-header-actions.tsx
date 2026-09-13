import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from '@/components/app-symbol';
import { useCallback, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { type SharedValue, useAnimatedReaction, useAnimatedStyle } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAuth } from '@/providers/auth-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { useDetailRoutes } from '@/services/action-sheet';
import { releaseWebNavigationFocus } from '@/services/navigation-focus';
import { getNotificationUnseenCount, loadNotificationsPage, subscribeNotificationUnreadCount } from '@/services/notifications';
import { expandedHeaderOpacity } from '@/services/main-header-transition';

type MainHeaderActionsProps = { visible?: boolean; offset?: SharedValue<number>; placement?: 'page' | 'toolbar' };

export default function MainHeaderActions(props: MainHeaderActionsProps) {
  const { width } = useWindowDimensions();
  if (Platform.OS === 'web' && width >= 960 && props.placement !== 'toolbar') return null;
  return <HeaderActionsContent {...props} />;
}

function HeaderActionsContent({ visible = true, offset }: MainHeaderActionsProps) {
  const router = useRouter();
  const { historyHref, notificationsHref } = useDetailRoutes();
  const { user } = useAuth();
  const { colors, dataSaver } = useAppSettings();
  const uid = user?.uid;
  const unreadCount = useSyncExternalStore(subscribeNotificationUnreadCount, () => getNotificationUnseenCount(uid), () => 0);
  const [actionsVisible, setActionsVisible] = useState(false);
  useAnimatedReaction(
    () => visible && (!offset || expandedHeaderOpacity(offset.value) > 0),
    (next, previous) => {
      if (next !== previous) scheduleOnRN(setActionsVisible, next);
    },
    [visible, offset],
  );

  useFocusEffect(useCallback(() => {
    // One shared, cached fetch on focus, never a timer or a fetch per header render.
    if (uid) void loadNotificationsPage(uid, null, { dataSaver }).catch(() => undefined);
  }, [dataSaver, uid]));

  const accessibilityLabel = unreadCount > 0 ? `Notifications, ${unreadCount} new in Crimson` : 'Open notifications';
  const icon = (
    <View style={styles.icon}>
      <SymbolView name="bell" size={21} tintColor={colors.text} weight="semibold" />
      {unreadCount > 0 && <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.background }]} />}
    </View>
  );
  const historyIcon = <SymbolView name="clock.arrow.circlepath" size={19} tintColor={colors.text} weight="semibold" />;
  return (
    <View style={styles.actions}>
      <HeaderIconButton
        accessibilityLabel="Open listening history"
        actionsVisible={visible && actionsVisible}
        offset={offset}
        onPress={() => { releaseWebNavigationFocus(); router.push(historyHref()); }}>
        {historyIcon}
      </HeaderIconButton>
      <HeaderIconButton
        accessibilityLabel={accessibilityLabel}
        actionsVisible={visible && actionsVisible}
        offset={offset}
        onPress={() => { releaseWebNavigationFocus(); router.push(notificationsHref()); }}>
        {icon}
      </HeaderIconButton>
    </View>
  );
}

/** Keep navigation icons bare while preserving their touch targets and scroll fade. */
function HeaderIconButton({ accessibilityLabel, children, actionsVisible, offset, onPress }: {
  accessibilityLabel: string;
  children: ReactNode;
  actionsVisible: boolean;
  offset?: SharedValue<number>;
  onPress: () => void;
}) {
  const { reduceMotion } = useAppSettings();
  const contentOpacity = useAnimatedStyle(() => ({ opacity: offset ? expandedHeaderOpacity(offset.value) : 1 }));
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={4}
      disabled={!actionsVisible}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && !reduceMotion && styles.pressed]}>
      <Animated.View pointerEvents="none" style={[styles.content, contentOpacity]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  button: { width: 40, height: 40, borderRadius: 20 },
  pressed: { transform: [{ scale: 0.97 }] },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
});
