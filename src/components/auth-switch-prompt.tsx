import { Pressable, StyleSheet, Text } from 'react-native';

type AuthSwitchPromptProps = {
  action: string;
  disabled?: boolean;
  onPress: () => void;
  prefix: string;
};

export default function AuthSwitchPrompt({
  action,
  disabled = false,
  onPress,
  prefix,
}: AuthSwitchPromptProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${prefix} ${action}`}
      disabled={disabled}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={styles.prompt}>
        {prefix}{' '}
        <Text style={styles.action}>{action}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  prompt: { color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: '400' },
  action: { color: '#A56DFF', fontWeight: '600' },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
});
