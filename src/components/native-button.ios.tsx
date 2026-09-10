import { Button, Host, Text as SwiftUIText } from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  background,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  shapes,
  strokeBorder,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NativeButtonProps } from '@/components/native-button.types';
import { useAppSettings } from '@/providers/settings-provider';

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
  const { colors, isDark, reduceMotion } = useAppSettings();
  const isGoogle = tone === 'google';
  const foreground = tone === 'text' || tone === 'accent' ? colors.accent : colors.text;
  const height = tone === 'text' ? 40 : size === 'large' ? 52 : 48;

  if (isGoogle) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
          styles.button,
          size === 'large' && styles.largeButton,
          disabled && styles.disabled,
          pressed && (reduceMotion ? styles.pressedStill : styles.pressed),
          style,
        ]}>
        <View style={[styles.googleSurface, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
          {icon}
          <Text style={[styles.googleLabel, { color: foreground }]}>{label}</Text>
        </View>
      </Pressable>
    );
  }

  const nativeButton = (
    <Host
      colorScheme={isDark ? 'dark' : 'light'}
      ignoreSafeArea="container"
      style={styles.host}>
      <Button
        onPress={onPress}
        modifiers={[
          buttonStyle('plain'),
          buttonBorderShape('capsule'),
          controlSize(size === 'large' ? 'large' : 'regular'),
          frame({ maxWidth: 10000, height }),
          background(colors.controlSurface, shapes.capsule()),
          strokeBorder({ content: colors.border, style: { lineWidth: StyleSheet.hairlineWidth }, shape: 'capsule' }),
          tint(foreground),
          disabledModifier(disabled),
          ...(testID ? [accessibilityIdentifier(testID)] : []),
        ]}>
        <SwiftUIText
          modifiers={[
            frame({ maxWidth: 10000, height }),
            font({ size: 15, weight: 'bold' }),
            foregroundStyle(foreground),
          ]}>
          {label}
        </SwiftUIText>
      </Button>
    </Host>
  );

  return (
    <View
      accessibilityRole="none"
      style={[
        styles.button,
        size === 'large' && styles.largeButton,
        tone === 'text' && styles.textButton,
        disabled && styles.disabled,
        style,
      ]}>
      {nativeButton}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    maxWidth: 430,
    height: 48,
    alignSelf: 'center',
  },
  largeButton: { height: 52 },
  textButton: { height: 40 },
  host: { flex: 1 },
  googleSurface: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  googleLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.975 }], opacity: 0.9 },
  pressedStill: { opacity: 0.9 },
  disabled: { opacity: 0.55 },
});
