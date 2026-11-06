import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/app-symbol';
import VisualizerIcon from '@/components/visualizer-icon';
import PopupSheetLayout from '@/components/popup-sheet-layout';
import { POPUP_CLOSE_CLEARANCE } from '@/components/popup-layout';
import { useAppSettings } from '@/providers/settings-provider';
import { VISUALIZER_STYLES } from '@/services/player-visualizer';

export default function VisualizerSheet({ onClose }: { onClose: () => void }) {
  const { colors, visualizerEnabled, visualizerStyle, performanceMode, reduceMotion, updateSettings } = useAppSettings();
  const insets = useSafeAreaInsets();
  return <PopupSheetLayout header={<View style={[styles.header, Platform.OS === 'web' && { paddingRight: 20 + POPUP_CLOSE_CLEARANCE }]}>
    <View style={styles.copy}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Visualizer</Text>
      <Text style={[styles.description, { color: colors.secondaryText }]}>Choose your player’s background.</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Close visualizer" onPress={onClose} style={styles.done}>
      <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 16 }}>Done</Text>
    </Pressable>
  </View>}>
    {(header) => <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
      {header}
      {[{ id: 'off' as const, name: 'Off', description: 'Use the original artwork background.' }, ...VISUALIZER_STYLES].map((option) => {
        const selected = option.id === 'off' ? !visualizerEnabled : visualizerEnabled && visualizerStyle === option.id;
        return <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.name} accessibilityState={{ checked: selected }}
          onPress={() => updateSettings(option.id === 'off' ? { visualizerEnabled: false } : { visualizerEnabled: true, visualizerStyle: option.id })}
          style={({ pressed }) => [styles.option, { borderColor: colors.border }, (selected || pressed) && { backgroundColor: colors.accentSoft }]}>
          <View style={styles.icon}>{option.id === 'off' ? <SymbolView name="power" size={26} tintColor={colors.secondaryText} /> : <VisualizerIcon style={option.id} color={colors.accent} size={36} />}</View>
          <View style={styles.copy}>
            <Text style={[styles.name, { color: selected ? colors.accent : colors.text }]}>{option.name}</Text>
            <Text style={[styles.description, { color: colors.secondaryText }]}>{option.description}</Text>
          </View>
          <View style={styles.check}>{selected ? <SymbolView name="checkmark.circle.fill" size={23} tintColor={colors.accent} /> : null}</View>
        </Pressable>;
      })}
      {visualizerEnabled && (performanceMode || reduceMotion) ? <Text style={[styles.notice, { color: colors.secondaryText }]}>Your selection is saved. Motion is paused while Reduce Motion or Performance Mode is on.</Text> : null}
    </ScrollView>}
  </PopupSheetLayout>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 23, fontWeight: '700' }, description: { fontSize: 13, lineHeight: 18, marginTop: 5 },
  done: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, copy: { flex: 1 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 76, paddingVertical: 14, paddingHorizontal: 20, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, alignItems: 'center' }, name: { fontSize: 17, fontWeight: '600' }, check: { width: 24 }, notice: { margin: 22, fontSize: 13, lineHeight: 19 },
});
