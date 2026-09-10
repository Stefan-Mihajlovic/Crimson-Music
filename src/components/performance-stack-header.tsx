import type { NativeStackHeaderProps } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSettings } from '@/providers/settings-provider';

// iOS 26 system navigation controls keep their glass even with blurEffect="none".
// This header is only mounted in Performance Mode; normal navigation stays native.
export default function PerformanceStackHeader({ back, navigation, options, route }: NativeStackHeaderProps) {
  const { colors } = useAppSettings();
  const insets = useSafeAreaInsets();
  const canGoBack = Boolean(back);
  const tintColor = options.headerTintColor || colors.text;
  const title = typeof options.headerTitle === 'string' ? options.headerTitle : options.title || route.name;

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.background }}>
      <View style={styles.bar}>
        <View style={styles.action}>
          {options.headerLeft
            ? options.headerLeft({ canGoBack, tintColor, label: back?.title })
            : canGoBack ? (
              <Pressable
                accessibilityLabel="Go back"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [styles.back, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
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
    </View>
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
