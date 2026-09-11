import { FrostedBackdrop } from '@/components/frosted-surface';
import { SymbolView } from '@/components/app-symbol';
import { Pressable, StyleSheet } from 'react-native';

import { useAppSettings } from '@/providers/settings-provider';

export default function NativeBackButton({ onPress }: { onPress: () => void }) {
  const { colors, reduceMotion } = useAppSettings();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: 'transparent', borderColor: colors.border }, pressed && (reduceMotion ? styles.pressedStill : styles.pressed)]}>
      <FrostedBackdrop radius={20} />
      <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(20,14,24,0.62)',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.8,
  },
  pressedStill: { opacity: 0.8 },
});
