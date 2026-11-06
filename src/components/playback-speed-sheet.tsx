import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/app-symbol';
import Switch from '@/components/app-switch';
import PopupSheetLayout from '@/components/popup-sheet-layout';
import { POPUP_CLOSE_CLEARANCE } from '@/components/popup-layout';
import { useAppSettings } from '@/providers/settings-provider';
import { normalizePlaybackSpeed, playbackSpeedLabel, PLAYBACK_SPEED_PRESETS } from '@/services/playback-controls';

const ticks = Array.from({ length: 31 }, (_, index) => index);

export default function PlaybackSpeedSheet({ onClose }: { onClose: () => void }) {
  const { colors, playbackSpeed, preservePitch, updateSettings } = useAppSettings();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<number | null>(null);
  const dragValue = useRef<number | null>(null);
  const webDragging = useRef(false);
  const [trackWidth, setTrackWidth] = useState(1);
  const speed = draft ?? playbackSpeed;
  const change = (value: number) => {
    dragValue.current = null;
    setDraft(null);
    updateSettings({ playbackSpeed: normalizePlaybackSpeed(value) });
  };
  const preview = (value: number) => {
    dragValue.current = normalizePlaybackSpeed(value);
    setDraft(dragValue.current);
  };
  const commit = () => { if (dragValue.current !== null) change(dragValue.current); };
  const cancel = () => { dragValue.current = null; setDraft(null); };
  // A thumb-sized inset keeps both endpoints inside the touch target. Only
  // commit after release: moving the ruler must not queue storage/audio writes.
  const valueAt = (x: number) => 0.5 + Math.max(0, Math.min(1, (x - 14) / Math.max(1, trackWidth - 28))) * 1.5;
  const percentage = (speed - 0.5) / 1.5 * 100;
  const stepButton = (direction: -1 | 1) => {
    const disabled = direction === -1 ? speed <= 0.5 : speed >= 2;
    return <Pressable accessibilityRole="button" accessibilityLabel={direction === -1 ? 'Decrease playback speed' : 'Increase playback speed'}
      accessibilityHint="Adjust by 0.05 times" disabled={disabled} onPress={() => change(speed + direction * 0.05)}
      style={({ pressed }) => [styles.step, { backgroundColor: colors.controlSurface, borderColor: colors.border, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 }]}>
      <SymbolView name={direction === -1 ? 'minus' : 'plus'} size={23} tintColor={colors.text} />
    </Pressable>;
  };
  return <PopupSheetLayout header={<View style={[styles.header, Platform.OS === 'web' && { paddingRight: 20 + POPUP_CLOSE_CLEARANCE }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Playback speed</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Close playback speed" onPress={onClose} style={styles.done}>
      <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 16 }}>Done</Text>
    </Pressable>
  </View>}>
    {(header) => <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
      {header}
      <View style={styles.content}>
        <View style={styles.readout}>
          {stepButton(-1)}
          <View style={styles.valueCopy}>
            <Text testID="playback-speed-value" style={[styles.value, { color: colors.text }]}>{speed.toFixed(2)}<Text style={styles.times}>×</Text></Text>
            <Text style={[styles.caption, { color: colors.secondaryText }]}>{speed === 1 ? 'Normal speed' : speed < 1 ? 'Slower' : 'Faster'}</Text>
          </View>
          {stepButton(1)}
        </View>
        {Platform.OS === 'web' ? <input aria-label="Playback speed" type="range" min={0.5} max={2} step={0.05} value={speed}
          aria-valuetext={playbackSpeedLabel(speed)} onChange={(event) => {
            const value = Number(event.currentTarget.value);
            if (webDragging.current) preview(value); else change(value);
          }}
          onPointerDown={() => { webDragging.current = true; }}
          onPointerUp={() => { webDragging.current = false; commit(); }}
          onBlur={() => { webDragging.current = false; commit(); }}
          onPointerCancel={() => { webDragging.current = false; cancel(); }}
          style={{ width: '100%', height: 48, margin: 0, accentColor: colors.accent }} /> :
          <View accessibilityRole="adjustable" accessibilityLabel="Playback speed" accessibilityHint="Swipe up or down to adjust speed"
            accessibilityValue={{ min: 0.5, max: 2, now: speed, text: playbackSpeedLabel(speed) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (nativeEvent.actionName === 'increment') change(speed + 0.05);
              else if (nativeEvent.actionName === 'decrement') change(speed - 0.05);
            }}
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onResponderGrant={(event) => preview(valueAt(event.nativeEvent.locationX))}
            onResponderMove={(event) => { if (dragValue.current !== null) preview(valueAt(event.nativeEvent.locationX)); }}
            onResponderRelease={commit} onResponderTerminate={cancel} onResponderTerminationRequest={() => false} style={styles.slider}>
            <View pointerEvents="none" style={styles.ruler}>
              {ticks.map((index) => <View key={index} style={[styles.tick, { left: `${index / 30 * 100}%`, height: index % 5 === 0 ? 18 : 9,
                backgroundColor: index / 20 + 0.5 <= speed ? colors.accent : colors.mutedText, opacity: index % 5 === 0 ? 0.9 : 0.4 }]} />)}
              <View style={[styles.track, { backgroundColor: colors.surfaceStrong }]}>
                <View style={[styles.fill, { width: `${percentage}%`, backgroundColor: colors.accent }]} />
              </View>
              <View style={[styles.thumb, { left: `${percentage}%`, backgroundColor: colors.accent, borderColor: colors.text }]} />
            </View>
          </View>}
        <View style={styles.scaleLabels}><Text style={[styles.caption, { color: colors.secondaryText }]}>0.5×</Text><Text style={[styles.caption, { color: colors.secondaryText }]}>Drag to fine-tune</Text><Text style={[styles.caption, { color: colors.secondaryText }]}>2×</Text></View>
        <View style={styles.presets}>
          {PLAYBACK_SPEED_PRESETS.map((preset) => <Pressable key={preset} accessibilityRole="radio" accessibilityLabel={preset === 1 ? 'Normal speed, 1×' : `${playbackSpeedLabel(preset)} speed`}
            accessibilityState={{ checked: speed === preset }} onPress={() => change(preset)}
            style={({ pressed }) => [styles.preset, { borderColor: speed === preset ? colors.accent : colors.border, backgroundColor: speed === preset ? colors.accentSoft : colors.controlSurface, opacity: pressed ? 0.65 : 1 }]}>
            <Text style={{ color: speed === preset ? colors.accent : colors.text, fontSize: 16, fontWeight: '600' }}>{preset === 1 ? '1× · Normal' : playbackSpeedLabel(preset)}</Text>
          </Pressable>)}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Reset to normal speed" disabled={speed === 1} onPress={() => change(1)}
          style={({ pressed }) => [styles.reset, { opacity: speed === 1 ? 0.4 : pressed ? 0.6 : 1 }]}>
          <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 14 }}>Reset to normal</Text>
        </Pressable>
        <View style={[styles.pitchRow, { borderColor: colors.border }]}>
          <View style={{ flex: 1 }}><Text style={[styles.pitchTitle, { color: colors.text }]}>Preserve pitch</Text>
            <Text style={[styles.pitchDescription, { color: colors.secondaryText }]}>Keep vocals and instruments in their original key.</Text></View>
          <Switch accessibilityLabel="Preserve pitch" value={preservePitch} onValueChange={(value) => updateSettings({ preservePitch: value })}
            trackColor={{ false: colors.surfaceStrong, true: colors.accent }} />
        </View>
        <Text style={[styles.footer, { color: colors.secondaryText }]}>Applies to all songs on this device.</Text>
      </View>
    </ScrollView>}
  </PopupSheetLayout>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 8, minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 22, fontWeight: '700', flexShrink: 1 }, done: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 22 }, readout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, gap: 8 },
  step: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  valueCopy: { flex: 1, alignItems: 'center' }, value: { fontSize: 52, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -2 }, times: { fontSize: 32 },
  caption: { fontSize: 12, lineHeight: 18 }, slider: { height: 62 }, ruler: { position: 'absolute', left: 14, right: 14, top: 0, bottom: 0 },
  tick: { position: 'absolute', width: 1, top: 4 }, track: { position: 'absolute', top: 36, left: 0, right: 0, height: 4, borderRadius: 2 },
  fill: { height: 4, borderRadius: 2 }, thumb: { position: 'absolute', top: 24, width: 28, height: 28, marginLeft: -14, borderRadius: 14, borderWidth: 3 },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 3 }, presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 22 },
  preset: { width: '31%', flexGrow: 1, minHeight: 48, paddingHorizontal: 4, paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  reset: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, pitchRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth },
  pitchTitle: { fontSize: 16, fontWeight: '600' }, pitchDescription: { fontSize: 13, lineHeight: 18, marginTop: 5 }, footer: { fontSize: 12, lineHeight: 18, marginTop: 4 },
});
