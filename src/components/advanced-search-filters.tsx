import Switch from '@/components/app-switch';
import { useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/providers/auth-provider';
import { usePopupLauncher } from '@/components/use-popup-session';
import { POPUP_CLOSE_CLEARANCE } from '@/components/popup-layout';
import PopupSheetLayout from '@/components/popup-sheet-layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/app-symbol';
import GlassPressable from '@/components/glass-pressable';
import { useAppSettings } from '@/providers/settings-provider';
import { normalizeSearchFilters, searchGenres, searchKeys, searchMoods, type AdvancedSearchFilters } from '@/services/search-filters';

/** Render this trigger as the first item in the existing search-result pill row. */
export default function AdvancedSearchFilterControls({ value, onChange }: { value: AdvancedSearchFilters; onChange: (filters: AdvancedSearchFilters) => void }) {
  const { colors } = useAppSettings();
  const { user } = useAuth();
  const { launch, open } = usePopupLauncher(user?.uid);
  const count = [value.genre, value.mood, value.musicalKey, value.bpmMin || value.bpmMax, value.downloadableOnly].filter(Boolean).length;
  const selected = Boolean(count || open);
  const tint = selected ? '#FFF' : colors.secondaryText;
  return <GlassPressable accessibilityLabel="Advanced song filters" cornerRadius={18} height={36}
    onPress={() => launch('search-filters', { value, onChange })}
    tintColor={selected ? colors.accent : colors.controlSurface}
    contentStyle={styles.triggerContent}
    style={[styles.trigger, { width: count ? 126 : 108 }, selected && { backgroundColor: colors.accent }]}>
    <SymbolView name="slider.horizontal.3" size={15} tintColor={tint} />
    <Text style={[styles.triggerText, { color: tint }]}>Filters{count ? ` · ${count}` : ''}</Text>
    <SymbolView name="chevron.down" size={12} tintColor={tint} />
  </GlassPressable>;
}

export function SearchFiltersForm({ value, onChange, onClose }: { value: AdvancedSearchFilters; onChange: (filters: AdvancedSearchFilters) => void; onClose: () => void }) {
  const { colors } = useAppSettings();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(value);
  const [min, setMin] = useState(value.bpmMin?.toString() || '');
  const [max, setMax] = useState(value.bpmMax?.toString() || '');
  const [error, setError] = useState('');
  const [picker, setPicker] = useState<'genre' | 'mood' | 'musicalKey' | null>(null);
  const pickerValues = picker === 'genre' ? searchGenres : picker === 'mood' ? searchMoods : searchKeys;
  const pickerTitle = picker === 'genre' ? 'Genre' : picker === 'mood' ? 'Mood' : 'Musical key';
  const close = onClose;
  const reset = () => {
    setDraft({}); setMin(''); setMax(''); setError('');
    // Clearing the last active filter can also remove the source result row.
    // Close in this action while its route is still available.
    onChange({});
    close();
  };
  return <PopupSheetLayout header={
          <View style={[styles.heading, Platform.OS === 'web' && { paddingRight: 20 + POPUP_CLOSE_CLEARANCE }]}>
            {picker ? <Pressable accessibilityRole="button" accessibilityLabel="Back to song filters" onPress={() => setPicker(null)} style={styles.back}><SymbolView name="chevron.left" size={18} tintColor={colors.text} /></Pressable> : null}
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{picker ? pickerTitle : 'Song filters'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close song filters panel" onPress={close} style={styles.clear}><Text style={{ color: colors.accent }}>Done</Text></Pressable>
          </View>}>
          {(inlineHeader) => picker ? <FlatList data={['Any', ...pickerValues]} ListHeaderComponent={inlineHeader} style={styles.scroll} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} keyExtractor={(item) => item} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: (draft[picker] || 'Any') === item }} onPress={() => { setDraft({ ...draft, [picker]: item === 'Any' ? undefined : item }); setPicker(null); }} style={styles.pickerRow}><Text style={{ color: colors.text, flex: 1 }}>{item}</Text>{(draft[picker] || 'Any') === item ? <SymbolView name="checkmark" size={18} tintColor={colors.accent} /> : null}</Pressable>} /> : <ScrollView style={styles.scroll} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
            {inlineHeader}
            <View style={styles.panel}>
            <View style={styles.choices}>
              {(['genre', 'mood', 'musicalKey'] as const).map((field) => <Pressable key={field} accessibilityRole="button" accessibilityLabel={`Choose ${field === 'musicalKey' ? 'musical key' : field}`} onPress={() => setPicker(field)} style={[styles.choice, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
                <Text style={{ color: colors.secondaryText, fontSize: 12 }}>{field === 'musicalKey' ? 'Key' : field === 'genre' ? 'Genre' : 'Mood'}</Text>
                <Text numberOfLines={1} style={{ color: colors.text, marginTop: 5 }}>{draft[field] || 'Any'}</Text>
              </Pressable>)}
            </View>
            <View style={styles.bpm}>
              <Text style={{ color: colors.text, flex: 1 }}>Tempo (BPM)</Text>
              <TextInput accessibilityLabel="Minimum BPM" keyboardType="number-pad" value={min} onChangeText={(text) => { setMin(text.replace(/[^0-9]/g, '').slice(0, 3)); setError(''); }} placeholder="Min" placeholderTextColor={colors.secondaryText} style={[styles.input, { color: colors.text, backgroundColor: colors.controlSurface, borderColor: colors.border }]} />
              <Text style={{ color: colors.secondaryText }}>–</Text>
              <TextInput accessibilityLabel="Maximum BPM" keyboardType="number-pad" value={max} onChangeText={(text) => { setMax(text.replace(/[^0-9]/g, '').slice(0, 3)); setError(''); }} placeholder="Max" placeholderTextColor={colors.secondaryText} style={[styles.input, { color: colors.text, backgroundColor: colors.controlSurface, borderColor: colors.border }]} />
            </View>
            <View style={styles.bpm}><Text style={{ color: colors.text, flex: 1 }}>Downloadable songs only</Text><Switch accessibilityLabel="Downloadable songs only" value={Boolean(draft.downloadableOnly)} onValueChange={(downloadableOnly) => setDraft({ ...draft, downloadableOnly })} trackColor={{ true: colors.accent }} /></View>
            {error ? <Text accessibilityRole="alert" style={{ color: colors.accent }}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Clear song filters" onPress={reset} style={styles.clear}><Text style={{ color: colors.accent }}>Clear</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Apply song filters" onPress={() => {
                if ((min && Number(min) < 1) || (max && Number(max) < 1)) { setError('BPM must be between 1 and 999.'); return; }
                try { onChange(normalizeSearchFilters({ ...draft, bpmMin: min ? Number(min) : undefined, bpmMax: max ? Number(max) : undefined })); close(); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check the BPM range.'); }
              }} style={[styles.apply, { backgroundColor: colors.accent }]}><Text style={{ color: '#FFF', fontWeight: '700' }}>Show songs</Text></Pressable>
            </View>
            </View>
          </ScrollView>}
  </PopupSheetLayout>;
}

const styles = StyleSheet.create({
  trigger: { borderRadius: 18, borderCurve: 'continuous' },
  triggerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  triggerText: { fontSize: 13, fontWeight: '600' },
  panel: { gap: 22, paddingTop: 8, paddingHorizontal: 20 }, choices: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, padding: 12, minHeight: 65, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  bpm: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44 },
  input: { width: 64, height: 44, padding: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, textAlign: 'center', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  apply: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  clear: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  scroll: { flex: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 21, fontWeight: '700', flex: 1 }, back: { width: 32, height: 44, justifyContent: 'center' },
  pickerRow: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
});
