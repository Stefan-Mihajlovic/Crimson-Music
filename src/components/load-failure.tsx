import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppSettings } from '@/providers/settings-provider';
export default function LoadFailure({
  title = 'Could not load this page',
  message = 'Check your connection and try again.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
}) {
  const { colors } = useAppSettings();
  return (
    <View accessibilityRole="alert" style={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.secondaryText }]}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={[
          styles.retry,
          {
            backgroundColor: colors.controlSurface,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={{ color: colors.accent, fontWeight: '700' }}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  content: { padding: 24, alignItems: 'center', gap: 12 },
  title: { fontSize: 19, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  retry: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: 'center',
  },
});
