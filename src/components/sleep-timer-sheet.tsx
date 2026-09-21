import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from '@/components/app-symbol';
import PopupSheetLayout from '@/components/popup-sheet-layout';
import { POPUP_CLOSE_CLEARANCE } from '@/components/popup-layout';
import { useAppSettings } from '@/providers/settings-provider';
import { sleepTimerMinutes, sleepTimerStatus, type SleepTimerMinutes, type SleepTimerSnapshot } from '@/services/sleep-timer';

export type SleepTimerSheetProps = {
  timer: SleepTimerSnapshot;
  currentSongTitle?: string | null;
  onStartMinutes: (minutes: SleepTimerMinutes) => void;
  onEndCurrentSong: () => void;
  onCancel: () => void;
  onClose: () => void;
};

/** Content for the shared native form sheet / web popup route. */
export default function SleepTimerSheet({ timer, currentSongTitle, onStartMinutes, onEndCurrentSong, onCancel, onClose }: SleepTimerSheetProps) {
  const { colors } = useAppSettings();
  const insets = useSafeAreaInsets();
  const active = timer.mode !== 'off';
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (timer.mode !== 'duration') return;
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [timer.mode]);
  return <PopupSheetLayout header={<View style={[styles.heading, Platform.OS === 'web' && { paddingRight: 20 + POPUP_CLOSE_CLEARANCE }]}>
    <View style={{ flex: 1 }}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Sleep timer</Text>
      <Text style={[styles.subtitle, { color: active ? colors.accent : colors.secondaryText }]}>{active ? sleepTimerStatus(timer, Math.max(now, (timer.deadlineAt ?? 0) - (timer.durationMinutes ?? 0) * 60_000)) : 'Pause playback automatically'}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Close sleep timer" onPress={onClose} style={styles.done}>
      <Text style={{ color: colors.accent, fontWeight: '600' }}>Done</Text>
    </Pressable>
  </View>}>
    {(inlineHeader) => <ScrollView style={styles.scroll} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
      {inlineHeader}
      {sleepTimerMinutes.map((minutes) => <TimerOption key={minutes} label={`${minutes} minutes`}
        selected={timer.mode === 'duration' && timer.durationMinutes === minutes} onPress={() => onStartMinutes(minutes)} />)}
      <TimerOption label="End of current song" subtitle={timer.mode === 'end-of-track' ? timer.endTitle : currentSongTitle || 'Play a song to use this option'}
        selected={timer.mode === 'end-of-track'} disabled={!currentSongTitle} onPress={onEndCurrentSong} />
      {active ? <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel sleep timer" onPress={onCancel}
          style={[styles.cancel, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>Cancel timer</Text>
        </Pressable>
      </View> : null}
    </ScrollView>}
  </PopupSheetLayout>;
}

function TimerOption({ label, subtitle, selected, disabled, onPress }: {
  label: string; subtitle?: string | null; selected: boolean; disabled?: boolean; onPress: () => void;
}) {
  const { colors } = useAppSettings();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled: Boolean(disabled) }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.option, { borderColor: colors.border },
      (pressed || selected) && { backgroundColor: colors.controlSurface }, disabled && { opacity: 0.45 }]}>
    <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontSize: 16, fontWeight: selected ? '600' : '400' }}>{label}</Text>
      {subtitle ? <Text numberOfLines={2} style={[styles.subtitle, { color: colors.secondaryText }]}>{subtitle}</Text> : null}</View>
    {selected ? <SymbolView name="checkmark" size={18} tintColor={colors.accent} /> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  heading: { minHeight: 94, paddingTop: 18, paddingBottom: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 5, fontVariant: ['tabular-nums'] },
  done: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  option: { minHeight: 52, paddingVertical: 12, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  cancel: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
});
