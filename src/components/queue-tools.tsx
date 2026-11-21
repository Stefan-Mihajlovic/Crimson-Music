import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from '@/components/app-symbol';
import { useAuth } from '@/providers/auth-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { createOwnedPlaylist } from '@/services/music';
import { requestLibraryRefresh } from '@/services/navigation-events';

/** Shared by the native sheet and desktop panel; capture the queue when opened. */
export default function QueueTools() {
  const player = usePlayer();
  const { user } = useAuth();
  const { colors } = useAppSettings();
  const [snapshot, setSnapshot] = useState<string[] | null>(null);
  const [title, setTitle] = useState('Listening queue');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const account = useRef(user?.uid);
  useLayoutEffect(() => {
    if (account.current !== user?.uid) { setSnapshot(null); setMessage(''); }
    account.current = user?.uid;
  }, [user?.uid]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const save = async () => {
    if (!user?.uid || !snapshot?.length || !title.trim() || busy.current) return;
    const uid = user.uid;
    busy.current = true; setSaving(true); setMessage('');
    try {
      await createOwnedPlaylist(uid, title.trim(), undefined, { visibility: 'private', trackIds: snapshot });
      requestLibraryRefresh();
      if (mounted.current && account.current === uid) { setSnapshot(null); setMessage('Private playlist saved to your library.'); }
    } catch {
      if (mounted.current && account.current === uid) setMessage('Could not save your queue. Please try again.');
    } finally { busy.current = false; if (mounted.current) setSaving(false); }
  };
  return <View style={styles.container}>
    {snapshot ? <View style={[styles.form, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Save {new Set(snapshot).size} songs as a playlist</Text>
      <TextInput accessibilityLabel="Queue playlist name" placeholder="Playlist name" placeholderTextColor={colors.secondaryText} editable={!saving} value={title} onChangeText={setTitle} maxLength={100} returnKeyType="done" onSubmitEditing={() => void save()} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
      <Text style={{ color: colors.secondaryText, fontSize: 12, lineHeight: 18 }}>Private by default. Includes songs from the entire queue, in order. Repeated songs are saved once.</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setSnapshot(null); setMessage(''); }} style={styles.button}><Text style={{ color: colors.secondaryText }}>Cancel</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Save queue playlist" disabled={saving || !title.trim()} onPress={() => void save()} style={[styles.button, { opacity: saving || !title.trim() ? 0.5 : 1 }]}>{saving ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accent, fontWeight: '700' }}>Save playlist</Text>}</Pressable>
      </View>
    </View> : user?.uid && player.queue.length ? <Pressable accessibilityRole="button" accessibilityLabel="Save queue as playlist" onPress={() => { setSnapshot(player.queue.map((song) => song.id)); setMessage(''); }} style={[styles.button, styles.save]}>
      <SymbolView name="plus" size={18} tintColor={colors.accent} /><Text style={{ color: colors.accent, fontWeight: '600' }}>Save queue as playlist</Text>
    </Pressable> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: colors.secondaryText, fontSize: 13, lineHeight: 19, paddingVertical: 8 }}>{message}</Text> : null}
  </View>;
}
export function QueueUndo() {
  const player = usePlayer();
  const { colors } = useAppSettings();
  if (!player.removedQueueSong) return null;
  return <View style={styles.container}>
    {player.removedQueueSong ? <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: colors.accentSoft }]}>
      <Text numberOfLines={2} style={[styles.copy, { color: colors.text }]}>{player.removedQueueSong.title} removed</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Undo remove from queue" onPress={player.undoQueueRemoval} style={styles.button}><Text style={{ color: colors.accent, fontWeight: '700' }}>Undo</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss undo" onPress={player.dismissQueueUndo} style={styles.button}><SymbolView name="xmark" size={16} tintColor={colors.secondaryText} /></Pressable>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 8 }, notice: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, borderRadius: 14, gap: 4, marginBottom: 6 },
  copy: { flex: 1, fontSize: 13 }, button: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  save: { alignSelf: 'flex-start', flexDirection: 'row', gap: 9, paddingHorizontal: 0 }, form: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
