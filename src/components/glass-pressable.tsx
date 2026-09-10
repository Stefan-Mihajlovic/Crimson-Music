import { Pressable, StyleSheet, View } from 'react-native';

import { GlassPressableProps } from '@/components/glass-pressable.types';
import { useAppSettings } from '@/providers/settings-provider';

export default function GlassPressable({
  accessibilityLabel,
  children,
  contentStyle,
  cornerRadius = 18,
  disabled = false,
  delayLongPress,
  height = 72,
  onPress,
  onLongPress,
  shape = 'roundedRectangle',
  style,
}: GlassPressableProps) {
  const { colors, reduceMotion } = useAppSettings();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      delayLongPress={delayLongPress}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.shell,
        { height, borderRadius: shape === 'circle' || shape === 'capsule' ? height / 2 : cornerRadius },
        { backgroundColor: colors.controlSurface, borderColor: colors.border },
        pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
        disabled && styles.disabled,
        style,
      ]}>
      <View pointerEvents="none" style={[styles.content, contentStyle]}>
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: { flex: 1 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  pressedStill: { opacity: 0.9 },
  disabled: { opacity: 0.52 },
});
