import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppSettings } from '@/providers/settings-provider';

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
  const { reduceMotion } = useAppSettings();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { height, borderRadius: height / 2 },
        pressed && !reduceMotion && styles.pressed,
        style,
      ]}>
      <VaultGlassSurface interactive radius={height / 2} style={StyleSheet.absoluteFill} />
      {/* Keep the glass and its ancestors opaque, including while disabled. */}
      <View pointerEvents="none" style={[styles.content, contentStyle, disabled && styles.disabledContent]}>
        {children}
      </View>
    </Pressable>
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
        glassEffectStyle="regular"
        isInteractive={interactive}
        tintColor="rgba(92,55,145,0.18)"
        style={[{ borderRadius: radius }, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View pointerEvents="none" style={[
      styles.fallback,
      { borderRadius: radius, backgroundColor: isDark ? colors.elevated : '#30263E', borderColor: colors.border },
      style,
    ]}>{children}</View>
  );
}

export function VaultGlassGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { performanceMode } = useAppSettings();
  return !performanceMode && isLiquidGlassAvailable() && isGlassEffectAPIAvailable()
    ? <GlassContainer spacing={6} style={style}>{children}</GlassContainer>
    : <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.97 }] },
  disabledContent: { opacity: 0.5 },
  fallback: { borderWidth: StyleSheet.hairlineWidth },
});
