import FrostedSurface from '@/components/frosted-surface';
import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppSettings } from '@/providers/settings-provider';

type PreferencesGlassSurfaceProps = {
  children?: ReactNode;
  radius?: number;
  selected?: boolean;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  tintColor?: string;
  effect?: 'regular' | 'clear';
};

type PreferencesGlassButtonProps = {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  height?: number;
  radius?: number;
  selected?: boolean;
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Place artwork behind this surface; keep external animated ancestors opaque. */
export function PreferencesGlassSurface({
  children,
  radius = 24,
  selected = false,
  interactive = false,
  style,
  tintColor,
  effect = 'regular',
}: PreferencesGlassSurfaceProps) {
  const { performanceMode } = useAppSettings();
  if (!performanceMode && isLiquidGlassAvailable() && isGlassEffectAPIAvailable()) {
    return (
      <NativePreferencesGlassSurface radius={radius} selected={selected} interactive={interactive} style={style} tintColor={tintColor} effect={effect}>
        {children}
      </NativePreferencesGlassSurface>
    );
  }
  return (
    <FrostedSurface tone="dark" radius={radius} style={style}>{children}</FrostedSurface>
  );
}

function NativePreferencesGlassSurface({ children, radius, selected, interactive, style, tintColor, effect = 'regular' }: PreferencesGlassSurfaceProps) {
  const { colors } = useAppSettings();
  const [laidOut, setLaidOut] = useState(false);
  return (
    <GlassView
      colorScheme="dark"
      glassEffectStyle={laidOut ? effect : 'none'}
      isInteractive={interactive}
      onLayout={() => setLaidOut(true)}
      tintColor={tintColor ?? (selected ? colors.accentSoft : undefined)}
      style={[
        styles.surface,
        { borderRadius: radius, borderColor: selected ? colors.accent : 'transparent' },
        style,
        styles.opaque,
      ]}>
      {children}
    </GlassView>
  );
}

export function PreferencesGlassButton({
  children,
  onPress,
  accessibilityLabel,
  disabled = false,
  height = 54,
  radius,
  selected = false,
  tintColor,
  style,
  contentStyle,
}: PreferencesGlassButtonProps) {
  const { performanceMode, reduceMotion } = useAppSettings();
  const buttonHeight = Math.max(44, height);
  const buttonRadius = radius ?? buttonHeight / 2;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { height: buttonHeight, borderRadius: buttonRadius },
        style,
        pressed && !reduceMotion && !performanceMode && styles.pressed,
        styles.minimumTarget,
        styles.opaque,
      ]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <PreferencesGlassSurface
          interactive={!disabled}
          radius={buttonRadius}
          selected={selected}
          tintColor={tintColor}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View pointerEvents="none" style={[styles.content, contentStyle, disabled && styles.disabledContent]}>
        {children}
      </View>
    </Pressable>
  );
}

export function PreferencesGlassGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { performanceMode } = useAppSettings();
  return !performanceMode && isLiquidGlassAvailable() && isGlassEffectAPIAvailable()
    ? <GlassContainer spacing={8} style={[style, styles.opaque]}>{children}</GlassContainer>
    : <View style={[style, styles.opaque]}>{children}</View>;
}

const styles = StyleSheet.create({
  surface: { borderWidth: StyleSheet.hairlineWidth, borderCurve: 'continuous' },
  button: { alignItems: 'center', justifyContent: 'center' },
  minimumTarget: { minWidth: 44, minHeight: 44 },
  content: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 0.97 }] },
  opaque: { opacity: 1 },
  disabledContent: { opacity: 0.5 },
});
