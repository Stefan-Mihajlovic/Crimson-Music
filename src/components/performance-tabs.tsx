import { webMobileMaterial } from '@/components/web-mobile-material';
import { FrostedBackdrop } from '@/components/frosted-surface';
import { Image } from 'expo-image';
import { type Href, useRouter, useSegments } from 'expo-router';
import { SymbolView, type SymbolViewProps } from '@/components/app-symbol';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { profileImageSource } from '@/components/profile-images';
import { BOTTOM_BAR_HORIZONTAL_INSET, WEB_BOTTOM_BAR_INSET, WEB_TAB_BAR_HEIGHT } from '@/components/player-layout';
import { useAuth } from '@/providers/auth-provider';
import { useAppSettings } from '@/providers/settings-provider';
import type { AppRouteGroup } from '@/services/action-sheet';
import { requestSearchFocus } from '@/services/navigation-events';

const tabs: { name: AppRouteGroup; href: Href; label: string; icon: SymbolViewProps['name'] }[] = [
  { name: '(home)', href: '/(app)/(home)', label: 'Home', icon: { ios: 'house.fill', android: 'home', web: 'home' } },
  { name: '(search)', href: '/(app)/(search)/search', label: 'Search', icon: { ios: 'magnifyingglass', android: 'search', web: 'search' } },
  { name: '(library)', href: '/(app)/(library)/library', label: 'Library', icon: { ios: 'folder', android: 'folder', web: 'folder' } },
  { name: '(account)', href: '/(app)/(account)/account', label: 'Account', icon: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' } },
];

/** Shared navigation for Android and Performance Mode, backed by the same tab navigator. */
export default function PerformanceTabs({ bottom, selectedGroup }: { bottom: number; selectedGroup?: string }) {
  const { colors, isDark, performanceMode } = useAppSettings();
  const web = Platform.OS === 'web';
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const activeGroup = selectedGroup ?? segments.find((segment) => tabs.some((tab) => tab.name === segment));
  return (
    <View style={[styles.bar, web && styles.webBar, { bottom, borderColor: colors.border }]}>
      {web ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 28, ...webMobileMaterial(isDark, performanceMode, colors.elevated) }]} /> : <FrostedBackdrop radius={31} />}
      {tabs.map((tab) => {
        const selected = activeGroup === tab.name;
        const color = selected ? colors.accent : colors.secondaryText;
        return (
          <Pressable
            key={tab.name}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => {
              router.navigate(tab.href);
              if (selected && tab.name === '(search)' && segments.at(-1) === 'search') requestSearchFocus();
            }}
            style={({ pressed }) => [styles.tab, selected && { backgroundColor: web ? colors.accentSoft : colors.background }, pressed && styles.pressed]}>
            {tab.name === '(account)' ? (
              <Image contentFit="cover" source={profileImageSource(user?.ProfilePhoto || '1')} style={[styles.avatar, web && styles.webAvatar, { borderColor: color }]} />
            ) : <SymbolView name={tab.icon} size={web ? 21 : 25} tintColor={color} weight={selected ? 'semibold' : 'regular'} />}
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
  webBar: { left: WEB_BOTTOM_BAR_INSET, right: WEB_BOTTOM_BAR_INSET, height: WEB_TAB_BAR_HEIGHT, padding: 3, borderRadius: 28 },
  webAvatar: { width: 23, height: 23, borderRadius: 12 },
  pressed: { opacity: 0.65 },
});
