import FrostedSurface from '@/components/frosted-surface';
/* eslint-disable react-hooks/immutability */

import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
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

/** Vault controls deliberately retain native glass over the illustrated card. */
export default function VaultGlassButton({
  accessibilityLabel,
  children,
  disabled = false,
  height = 44,
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
        { height, borderRadius: height / 2 },
        style,
        pressStyle,
      ]}>
      <VaultGlassSurface interactive radius={height / 2} style={StyleSheet.absoluteFill} />
      {/* Keep the glass and its ancestors opaque, including while disabled. */}
      <View pointerEvents="none" style={[styles.content, contentStyle, disabled && styles.disabledContent]}>
        {children}
      </View>
    </AnimatedPressable>
  );
}

export function VaultGlassSurface({ radius, interactive = false, style, children }: {
  radius: number;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const { colors, isDark, performanceMode } = useAppSettings();
  if (!performanceMode && isLiquidGlassAvailable() && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        pointerEvents="none"
        colorScheme="dark"
        glassEffectStyle="clear"
        isInteractive={interactive}
        tintColor="rgba(145,92,235,0.26)"
        style={[styles.glassEdge, { borderRadius: radius }, style]}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.02)', 'rgba(175,130,255,0.12)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
        {children}
      </GlassView>
    );
  }
  return (
    <FrostedSurface tone="dark" solidColor={isDark ? colors.elevated : '#30263E'} radius={radius} style={style}>{children}</FrostedSurface>
  );
}

export function VaultGlassGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { performanceMode } = useAppSettings();
  return !performanceMode && isLiquidGlassAvailable() && isGlassEffectAPIAvailable()
    ? <GlassContainer spacing={12} style={style}>{children}</GlassContainer>
    : <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  glassEdge: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(230,215,255,0.38)' },
  disabledContent: { opacity: 0.5 },
  fallback: { borderWidth: StyleSheet.hairlineWidth },
});
