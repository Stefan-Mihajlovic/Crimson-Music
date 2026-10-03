import Switch from '@/components/app-switch';
import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/app-symbol';
import PopupSheetLayout from '@/components/popup-sheet-layout';
import { POPUP_CLOSE_CLEARANCE } from '@/components/popup-layout';
import { useAppSettings } from '@/providers/settings-provider';
import { EQUALIZER_FREQUENCIES, EQUALIZER_PRESETS, equalizerPresetName } from '@/services/equalizer';

export default function EqualizerSheet({ onClose }: { onClose: () => void }) {
  const { colors, equalizer, updateSettings } = useAppSettings();
  const insets = useSafeAreaInsets();
  const description = EQUALIZER_PRESETS.find((preset) => preset.id === equalizer.preset)?.description ?? 'Your own balance, saved on this device.';
  const setBand = (index: number, value: number) => updateSettings({ equalizer: {
    ...equalizer, enabled: true, preset: 'custom', bands: equalizer.bands.map((gain, i) => i === index ? value : gain),
  } });
  return <PopupSheetLayout header={<View style={[styles.header, Platform.OS === 'web' && { paddingRight: 20 + POPUP_CLOSE_CLEARANCE }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Equalizer</Text>
    <Pressable accessibilityRole="button" onPress={onClose} style={styles.done}><Text style={{ color: colors.accent, fontSize: 16 }}>Done</Text></Pressable>
  </View>}>
    {(header) => <ScrollView style={styles.scroll} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
      {header}
      <View style={styles.content}>
        <View style={styles.enabledRow}>
          <SymbolView name="slider.horizontal.3" size={23} tintColor={colors.accent} />
          <View style={styles.copy}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{equalizer.enabled ? equalizerPresetName(equalizer) : 'Equalizer off'}</Text>
            <Text style={[styles.description, { color: colors.secondaryText }]}>{equalizer.enabled ? description : 'Choose a preset or tune your sound below.'}</Text>
          </View>
          <Switch accessibilityLabel="Enable equalizer" value={equalizer.enabled} onValueChange={(enabled) => updateSettings({ equalizer: { ...equalizer, enabled } })}
            trackColor={{ true: colors.accent, false: colors.surfaceStrong }} thumbColor="#FFFFFF" />
        </View>
        <Text style={[styles.section, { color: colors.secondaryText }]}>Presets</Text>
        <View style={styles.presets}>
          {EQUALIZER_PRESETS.map((preset) => {
            const selected = equalizer.preset === preset.id;
            return <Pressable key={preset.id} accessibilityRole="button" accessibilityState={{ selected }}
              onPress={() => updateSettings({ equalizer: { enabled: true, preset: preset.id, bands: [...preset.bands] } })}
              style={({ pressed }) => [styles.preset, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accentSoft : colors.controlSurface, opacity: pressed ? 0.65 : 1 }]}>
              <Text style={{ color: selected ? colors.accent : colors.text, fontWeight: '600', fontSize: 14 }}>{preset.name}</Text>
            </Pressable>;
          })}
        </View>
        <View style={styles.tuningHeader}>
          <Text style={[styles.section, { color: colors.secondaryText }]}>Fine tune</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Reset equalizer to flat" style={styles.done} onPress={() => updateSettings({ equalizer: { ...equalizer, preset: 'flat', bands: [0, 0, 0, 0, 0] } })}>
            <Text style={{ color: colors.accent, fontSize: 14 }}>Reset</Text>
          </Pressable>
        </View>
        {EQUALIZER_FREQUENCIES.map((frequency, index) => <EqualizerBand key={frequency} frequency={frequency} value={equalizer.bands[index]} onChange={(value) => setBand(index, value)} />)}
        <Text style={[styles.hint, { color: colors.secondaryText }]}>Lower frequencies shape the bass; higher frequencies shape the treble. Your sound settings are saved on this device.</Text>
      </View>
    </ScrollView>}
  </PopupSheetLayout>;
}

function EqualizerBand({ frequency, value, onChange }: { frequency: number; value: number; onChange: (value: number) => void }) {
  const { colors } = useAppSettings();
  const [width, setWidth] = useState(1);
  const active = useRef(false);
  const label = frequency >= 1000 ? `${frequency / 1000} kHz` : `${frequency} Hz`;
  const update = (x: number) => onChange(Math.round(Math.max(-12, Math.min(12, x / width * 24 - 12))));
  return <View style={styles.band}>
    <Text style={[styles.frequency, { color: colors.secondaryText }]}>{label}</Text>
    {Platform.OS === 'web' ? <input aria-label={`${label} gain`} type="range" min={-12} max={12} step={1} value={value}
      onChange={(event) => onChange(Number(event.currentTarget.value))} style={{ flex: 1, minWidth: 0, accentColor: colors.accent }} />
      : <View accessibilityRole="adjustable" accessibilityLabel={`${label} gain`} accessibilityValue={{ min: -12, max: 12, now: value, text: `${value} decibels` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={({ nativeEvent }) => onChange(Math.max(-12, Math.min(12, value + (nativeEvent.actionName === 'increment' ? 1 : -1))))}
          onLayout={(event) => setWidth(Math.max(1, event.nativeEvent.layout.width))}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(event) => { active.current = true; update(event.nativeEvent.locationX); }}
          onResponderMove={(event) => { if (active.current) update(event.nativeEvent.locationX); }}
          onResponderRelease={() => { active.current = false; }} onResponderTerminate={() => { active.current = false; }} style={styles.slider}>
          <View pointerEvents="none" style={[styles.track, { backgroundColor: colors.surfaceStrong }]}>
            <View style={[styles.zero, { backgroundColor: colors.mutedText }]} />
            <View style={[styles.fill, { backgroundColor: colors.accent, left: `${Math.min(50, (value + 12) / 24 * 100)}%`, width: `${Math.abs(value) / 24 * 100}%` }]} />
          </View>
          <View pointerEvents="none" style={[styles.thumb, { backgroundColor: colors.accent, left: `${(value + 12) / 24 * 100}%` }]} />
        </View>}
    <Text style={[styles.gain, { color: colors.text }]}>{value > 0 ? '+' : ''}{value} dB</Text>
  </View>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, minHeight: 64 },
  title: { fontSize: 21, fontWeight: '700' }, done: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 22 }, enabledRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, copy: { flex: 1 },
  rowTitle: { fontSize: 17, fontWeight: '600' }, description: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  section: { fontSize: 13, fontWeight: '600', marginVertical: 12 }, presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, minHeight: 42, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  tuningHeader: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  band: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 14 }, frequency: { width: 61, fontSize: 13 }, gain: { width: 48, textAlign: 'right', fontSize: 13, fontVariant: ['tabular-nums'] },
  slider: { flex: 1, height: 44, justifyContent: 'center' }, track: { height: 4, borderRadius: 2 }, zero: { position: 'absolute', height: 10, width: 1, left: '50%', top: -3 },
  fill: { height: 4, position: 'absolute', borderRadius: 2 }, thumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10, marginLeft: -10 },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 15 },
});
