import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NativeButtonProps } from '@/components/native-button.types';
import { useAppSettings } from '@/providers/settings-provider';

export type { NativeButtonProps, NativeButtonTone } from '@/components/native-button.types';

export default function NativeButton({
  label,
  onPress,
  disabled = false,
  icon,
  size = 'regular',
  tone = 'primary',
  style,
  testID,
}: NativeButtonProps) {
  const { colors, reduceMotion } = useAppSettings();
  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: false }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        size === 'large' && styles.largeButton,
        tone === 'text' && styles.textButton,
        disabled && styles.disabled,
        pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
        style,
      ]}>
      <View style={[styles.surface, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: tone === 'text' || tone === 'accent' ? colors.accent : colors.text }]}>
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: '100%', maxWidth: 430, height: 48, alignSelf: 'center', borderRadius: 24, overflow: 'hidden' },
  largeButton: { height: 52, borderRadius: 26 },
  textButton: { height: 40, borderRadius: 20 },
  surface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.975 }], opacity: 0.9 },
  pressedStill: { opacity: 0.9 },
  disabled: { opacity: 0.55 },
});
