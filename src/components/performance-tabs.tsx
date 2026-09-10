import { Image } from 'expo-image';
import { useNavigation, useRootNavigationState } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { profileImageSource } from '@/components/profile-images';
import { BOTTOM_BAR_HORIZONTAL_INSET } from '@/components/player-layout';
import { useAuth } from '@/providers/auth-provider';
import { useAppSettings } from '@/providers/settings-provider';
import type { AppRouteGroup } from '@/services/action-sheet';
import { requestSearchFocus } from '@/services/navigation-events';

const tabs: { name: AppRouteGroup; label: string; icon: SymbolViewProps['name'] }[] = [
  { name: '(home)', label: 'Home', icon: { ios: 'house.fill', android: 'home', web: 'home' } },
  { name: '(search)', label: 'Search', icon: { ios: 'magnifyingglass', android: 'search', web: 'search' } },
  { name: '(library)', label: 'Library', icon: { ios: 'folder', android: 'folder', web: 'folder' } },
  { name: '(account)', label: 'Account', icon: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' } },
];

/** iOS 26 ignores native tab blur overrides. Hide that bar and control the same navigator. */
export default function PerformanceTabs() {
  const { colors } = useAppSettings();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const root = useRootNavigationState();
  const state = root.routes.find((route) => route.name === '(app)')?.state;
  return (
    <View style={[styles.bar, { bottom: Math.max(8, insets.bottom - 8), backgroundColor: colors.elevated, borderColor: colors.border }]}>
      {tabs.map((tab) => {
        const selected = state?.routes[state.index ?? 0]?.name === tab.name;
        const color = selected ? colors.accent : colors.secondaryText;
        return (
          <Pressable
            key={tab.name}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!state?.key) return;
              if (selected && tab.name === '(search)') requestSearchFocus();
              if (!selected) navigation.dispatch({ type: 'NAVIGATE', target: state.key, payload: { name: tab.name } });
            }}
            style={({ pressed }) => [styles.tab, selected && { backgroundColor: colors.background }, pressed && styles.pressed]}>
            {tab.name === '(account)' ? (
              <Image contentFit="cover" source={profileImageSource(user?.ProfilePhoto || '1')} style={[styles.avatar, { borderColor: color }]} />
            ) : <SymbolView name={tab.icon} size={25} tintColor={color} weight={selected ? 'semibold' : 'regular'} />}
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: BOTTOM_BAR_HORIZONTAL_INSET, right: BOTTOM_BAR_HORIZONTAL_INSET, height: 62, padding: 4, borderRadius: 31, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 27 },
  avatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5 },
  label: { fontSize: 11, fontWeight: '600' },
  pressed: { opacity: 0.65 },
});
