import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SFSymbol } from 'sf-symbols-typescript';
import ResponsivePopup from '@/components/responsive-popup';
import LocalMusicArtwork from '@/components/local-music-artwork';
import { SymbolView } from '@/components/app-symbol';
import { POPUP_CLOSE_CLEARANCE, POPUP_DESKTOP_INSET, POPUP_MOBILE_INSET } from '@/components/popup-layout';
import { useAppSettings } from '@/providers/settings-provider';
import { getActionSheetAnchor, releaseWebNavigationFocus } from '@/services/action-sheet';
import { Alert } from '@/services/alert';
import { importLocalMusic, LOCAL_MUSIC_ID, scanLocalMusic } from '@/services/local-music';

export default function LocalMusicActionsSheet() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  const insets = useSafeAreaInsets();
  const { colors } = useAppSettings();
  const [anchor] = useState(() => Platform.OS === 'web' ? getActionSheetAnchor(LOCAL_MUSIC_ID) : null);
  const [working, setWorking] = useState(false);
  const pending = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inset = desktop ? POPUP_DESKTOP_INSET : POPUP_MOBILE_INSET;
  const dismiss = () => { releaseWebNavigationFocus(); if (router.canGoBack()) router.dismiss(); else router.replace('/'); };
  const collect = async (mode: 'files' | 'folder' | 'scan') => {
    if (pending.current) return;
    pending.current = true; setWorking(true); setMessage(''); setError('');
    try {
      // Keep web picker invocation in the button gesture before any awaited work.
      const result = await (mode === 'scan' ? scanLocalMusic() : importLocalMusic(mode === 'folder'));
      const omitted = result.skipped ? ` ${result.skipped} ${Platform.OS === 'ios' && mode === 'scan' ? 'cloud or protected items are unavailable to Crimson' : 'files could not be imported'}.` : '';
      setMessage(`${mode === 'scan' ? 'Found' : 'Imported'} ${result.added} audio ${result.added === 1 ? 'file' : 'files'}.${omitted}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Audio could not be loaded. Try again.'); }
    finally { pending.current = false; setWorking(false); }
  };
  return <ResponsivePopup label="Local Music options" anchor={anchor} onDismiss={dismiss}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 8 : insets.bottom + 20 }}>
      <View style={[styles.header, desktop && styles.desktopHeader, Platform.OS === 'web' && { padding: inset, paddingRight: inset + POPUP_CLOSE_CLEARANCE, minHeight: 0 }]}>
        <LocalMusicArtwork size={desktop ? 24 : 36} style={{ width: desktop ? 42 : 64, height: desktop ? 42 : 64, borderRadius: desktop ? 9 : 17 }} />
        <View style={{ flex: 1 }}><Text style={[styles.title, desktop && { fontSize: 14, fontWeight: '700' }, { color: colors.text }]}>Local Music</Text><Text style={{ color: colors.secondaryText, fontSize: 14, marginTop: 3 }}>On this device</Text></View>
      </View>
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
      <LocalMusicActionRow label="Import audio files" icon="plus" desktop={desktop} working={working} onPress={() => void collect('files')} />
      <LocalMusicActionRow label={Platform.OS === 'web' ? 'Import folder' : 'Scan device'} icon={Platform.OS === 'web' ? 'folder' : 'arrow.clockwise'} desktop={desktop} working={working} onPress={() => void collect(Platform.OS === 'web' ? 'folder' : 'scan')} />
      <LocalMusicActionRow label="About Local Music" icon="info.circle" desktop={desktop} working={working} onPress={() => Alert.alert('Local Music', Platform.OS === 'ios'
        ? 'Import audio from Files, or scan downloaded, unprotected music in your Apple Music library. You can also copy audio into CrimsonMusic → CrimsonLocalMusic in Files. iOS does not share protected subscription downloads or other apps’ private files.'
        : Platform.OS === 'android' ? 'Scan finds music, recordings and other audio shared by your device. It needs Music and audio access. Imported copies stay in Crimson; removing a copy does not delete the original.'
          : 'Imported audio stays in this browser and works offline. Clearing site data removes imported copies. Your browser can only read files and folders you choose.')} />
      {working ? <View style={styles.status}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.secondaryText }}>Reading your audio…</Text></View> : null}
      {message || error ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: error ? colors.text : colors.secondaryText }]}>{error || message}</Text> : null}
      {error && Platform.OS !== 'web' && /access|allow|permission/i.test(error) ? <LocalMusicActionRow label="Open system Settings" icon="gearshape" desktop={desktop} working={working} onPress={() => { void Linking.openSettings(); }} /> : null}
    </ScrollView>
  </ResponsivePopup>;
}
function LocalMusicActionRow({ label, icon, onPress, working, desktop }: { label: string; icon: SFSymbol; onPress: () => void; working: boolean; desktop: boolean }) {
  const { colors } = useAppSettings();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={working} onPress={onPress}
    style={({ pressed }) => [styles.row, desktop && styles.desktopRow, pressed && { backgroundColor: colors.controlSurface }, working && { opacity: 0.48 }]}>
    <SymbolView name={icon} size={desktop ? 19 : 23} tintColor={colors.text} style={{ width: desktop ? 23 : 28 }} />
    <Text style={[styles.label, desktop && { fontSize: 13, fontWeight: '500' }, { color: colors.text }]}>{label}</Text>
    {!desktop ? <SymbolView name="chevron.right" size={13} tintColor={colors.mutedText} /> : null}
  </Pressable>;
}
const styles = StyleSheet.create({
  header: { minHeight: 108, flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 21 },
  desktopHeader: { gap: 11 }, title: { fontSize: 20, fontWeight: '800' },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 15, paddingHorizontal: 22, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(231,222,241,0.14)' },
  desktopRow: { minHeight: 40, marginHorizontal: 5, borderRadius: 8, gap: 10, paddingHorizontal: 11, borderBottomWidth: 0 },
  label: { flex: 1, fontSize: 17, fontWeight: '600' }, status: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 20 },
  message: { fontSize: 13, lineHeight: 20, paddingHorizontal: 22, paddingVertical: 16 },
});
