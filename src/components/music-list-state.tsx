import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from '@/components/app-symbol';
import { useAppSettings } from '@/providers/settings-provider';

export default function MusicListState({ loading = false, title = 'Find your next favorite', message, action, onAction }: {
  loading?: boolean; title?: string; message?: string; action?: string; onAction?: () => void;
}) {
  const { colors } = useAppSettings();
  if (loading) return <View accessibilityLabel="Loading songs" accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={styles.loading}>
    {[0, 1, 2, 3].map((index) => <View key={index} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.skeletonRow}>
      <View style={[styles.cover, { backgroundColor: colors.border }]} /><View style={{ flex: 1, gap: 9 }}><View style={[styles.line, { backgroundColor: colors.border, width: `${76 - index * 9}%` }]} /><View style={[styles.line, { backgroundColor: colors.border, width: '44%', opacity: 0.55 }]} /></View>
    </View>)}
  </View>;
  return <View style={styles.state} accessibilityLiveRegion="polite">
    <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}><SymbolView name="music.note.list" size={28} tintColor={colors.accent} /></View>
    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
    {message ? <Text style={[styles.message, { color: colors.secondaryText }]}>{message}</Text> : null}
    {action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={[styles.action, { backgroundColor: colors.accentSoft }]}><Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>{action}</Text></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  state: { alignItems: 'center', paddingHorizontal: 26, paddingVertical: 30, gap: 12 }, icon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' }, message: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 360 }, action: { minHeight: 44, borderRadius: 22, paddingHorizontal: 22, justifyContent: 'center' },
  loading: { padding: 20, gap: 20 }, skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 14 }, cover: { width: 46, height: 46, borderRadius: 10 }, line: { height: 10, borderRadius: 5 },
});
