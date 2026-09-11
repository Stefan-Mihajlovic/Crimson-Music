import { FrostedBackdrop, FrostedLayer } from '@/components/frosted-surface';
import type { NativeStackHeaderProps } from 'expo-router';
import { SymbolView } from '@/components/app-symbol';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSettings } from '@/providers/settings-provider';
import { releaseWebNavigationFocus } from '@/services/navigation-focus';

// iOS 26 system navigation controls keep their glass even with blurEffect="none".
// Android/web share this header with frosted controls; Performance Mode is opaque.
export default function PerformanceStackHeader({ back, navigation, options, route }: NativeStackHeaderProps) {
  const { colors } = useAppSettings();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const canGoBack = Boolean(back);
  const tintColor = options.headerTintColor || colors.text;
  const title = typeof options.headerTitle === 'string' ? options.headerTitle : options.title || route.name;

  return (
    <FrostedLayer style={{ paddingTop: insets.top }} background={<View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />}>

      <FrostedBackdrop radius={0} solidColor={colors.background} />
      <View style={[styles.bar, Platform.OS === 'web' && { minHeight: 64, paddingVertical: 12, paddingHorizontal: width >= 960 ? 24 : 20 }]}>
        <View style={styles.action}>
          {options.headerLeft
            ? options.headerLeft({ canGoBack, tintColor, label: back?.title })
            : canGoBack ? (
              <Pressable
                accessibilityLabel="Go back"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => { releaseWebNavigationFocus(); navigation.goBack(); }}
                style={({ pressed }) => [styles.back, { backgroundColor: 'transparent' }, pressed && styles.pressed]}>
                <FrostedBackdrop radius={20} solidColor={colors.surface} />
                <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={tintColor} />
              </Pressable>
            ) : null}
        </View>
        <View style={styles.title}>
          {typeof options.headerTitle === 'function'
            ? options.headerTitle({ children: title, tintColor })
            : <Text accessibilityRole="header" numberOfLines={1} style={[styles.titleText, { color: tintColor }, options.headerTitleStyle]}>{title}</Text>}
        </View>
        <View style={[styles.action, styles.right]}>{options.headerRight?.({ canGoBack, tintColor })}</View>
      </View>
    </FrostedLayer>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  action: { minWidth: 40, flexShrink: 0 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  title: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleText: { fontSize: 17, fontWeight: '600' },
  right: { alignItems: 'flex-end' },
});
