import FrostedSurface from '@/components/frosted-surface';
/* eslint-disable react-hooks/immutability */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useAppSettings } from '@/providers/settings-provider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type VaultGlassButtonProps = {
  accessibilityLabel: string;
  children: ReactNode;
  disabled?: boolean;
  height?: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Shared dark, frosted controls keep the same appearance on every platform. */
export default function VaultGlassButton({
  accessibilityLabel,
  children,
  disabled = false,
  height = 52,
  onPress,
  style,
  contentStyle,
}: VaultGlassButtonProps) {
  const { performanceMode, reduceMotion } = useAppSettings();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = reduceMotion || performanceMode ? 1 : withTiming(0.95, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = reduceMotion || performanceMode ? 1 : withSpring(1, { damping: 9, stiffness: 300, mass: 0.45 });
      }}
      style={[
        styles.button,
        { height, borderRadius: 12 },
        style,
        pressStyle,
      ]}>
      <VaultGlassSurface radius={12} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[styles.content, contentStyle, disabled && styles.disabledContent]}>
        {children}
      </View>
    </AnimatedPressable>
  );
}

export function VaultGlassSurface({ radius, style, children }: {
  radius: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <FrostedSurface tone="dark" solidColor="#10071F" intensity={70} radius={radius}
      style={style}>
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glassEdge, { borderRadius: radius }]} />
    </FrostedSurface>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  glassEdge: { borderWidth: 1, borderColor: 'rgba(231,224,255,0.85)' },
  disabledContent: { opacity: 0.5 },
});
