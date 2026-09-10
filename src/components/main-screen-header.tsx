import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { useAppSettings } from '@/providers/settings-provider';
import { expandedHeaderOpacity } from '@/services/main-header-transition';

export default function MainScreenHeader({ title, trailing, offset }: {
  title: string;
  trailing?: ReactNode;
  offset?: SharedValue<number>;
}) {
  const { colors } = useAppSettings();
  const style = useAnimatedStyle(() => ({ opacity: offset ? expandedHeaderOpacity(offset.value) : 1 }));
  return (
    <View style={styles.header}>
      <Animated.Text accessibilityRole="header" style={[styles.title, { color: colors.text }, style]}>{title}</Animated.Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flexShrink: 1,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
});
