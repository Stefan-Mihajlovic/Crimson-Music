import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from '@/components/app-symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '@/providers/settings-provider';
import { confirmAction } from '@/services/confirm-action';
import { deleteOwnedPlaylist, updateOwnedPlaylist } from '@/services/music';
import type { CrimsonPlaylist, CrimsonSong } from '@/types/music';

export default function PlaylistEditor({
  uid,
  playlist,
  songs,
  onClose,
  onSaved,
  onDeleted,
}: {
  uid: string;
  playlist: CrimsonPlaylist;
  songs: CrimsonSong[];
  onClose: () => void;
  onSaved: (playlist: CrimsonPlaylist) => void;
  onDeleted: () => void;
}) {
  const { colors } = useAppSettings();
  const insets = useSafeAreaInsets();
  const originalIds = playlist.songs.length
    ? playlist.songs
    : songs.map((song) => song.id);
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description || '');
  const [visibility, setVisibility] = useState<'private' | 'public'>(
    playlist.visibility || 'public',
  );
  const [trackIds, setTrackIds] = useState(originalIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const songMap = new Map(songs.map((song) => [song.id, song]));
  const dirty =
    title !== playlist.title ||
    description !== (playlist.description || '') ||
    visibility !== (playlist.visibility || 'public') ||
    trackIds.join('|') !== originalIds.join('|');
  const close = () => {
    if (busy.current) return;
    if (!dirty) {
      onClose();
      return;
    }
    void confirmAction(
      'Discard changes?',
      'Your playlist has not been changed yet.',
      'Discard',
    ).then((confirmed) => {
      if (confirmed && !busy.current) onClose();
    });
  };
  const save = async () => {
    if (busy.current || !title.trim()) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      const next = await updateOwnedPlaylist(uid, playlist.id, {
        title,
        description,
        visibility,
        trackIds,
        expectedTrackIds: originalIds,
      });
      onSaved(next);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not save. Try again.',
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const removePlaylist = () => {
    void confirmAction(
      'Delete this playlist?',
      `“${playlist.title}” will be deleted from your Audius account. This cannot be undone.`,
      'Delete playlist',
    ).then((confirmed) => {
      if (!confirmed || busy.current) return;
      busy.current = true;
      setSaving(true);
      setError('');
      void deleteOwnedPlaylist(uid, playlist.id)
        .then(onDeleted)
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not delete the playlist.',
          ),
        )
        .finally(() => {
          busy.current = false;
          setSaving(false);
        });
    });
  };
  const move = (index: number, delta: number) =>
    setTrackIds((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[
          styles.screen,
          { backgroundColor: colors.background, paddingTop: insets.top + 8 },
        ]}
      >
        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={close}
            style={styles.navAction}
          >
            <Text style={{ color: colors.text }}>Cancel</Text>
          </Pressable>
          <Text style={[styles.heading, { color: colors.text }]}>
            Edit playlist
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={saving || !title.trim()}
            onPress={() => void save()}
            style={styles.navAction}
          >
            {saving ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={{ color: colors.accent, fontWeight: '700' }}>
                Save
              </Text>
            )}
          </Pressable>
        </View>
        <FlatList
          data={trackIds}
          keyExtractor={(id, index) => `${id}:${index}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 24,
          }}
          ListHeaderComponent={
            <View style={{ gap: 12, paddingVertical: 20 }}>
              <Text style={[styles.label, { color: colors.secondaryText }]}>
                NAME
              </Text>
              <TextInput
                accessibilityLabel="Playlist name"
                value={title}
                onChangeText={setTitle}
                maxLength={80}
                editable={!saving}
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    backgroundColor: colors.controlSurface,
                    borderColor: colors.border,
                  },
                ]}
              />
              <Text style={[styles.label, { color: colors.secondaryText }]}>
                DESCRIPTION
              </Text>
              <TextInput
                accessibilityLabel="Playlist description"
                value={description}
                onChangeText={setDescription}
                maxLength={1000}
                multiline
                editable={!saving}
                placeholder="Add a description"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  {
                    minHeight: 86,
                    color: colors.text,
                    backgroundColor: colors.controlSurface,
                    borderColor: colors.border,
                  },
                ]}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['public', 'private'] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: visibility === value }}
                    disabled={saving}
                    onPress={() => setVisibility(value)}
                    style={[
                      styles.privacy,
                      {
                        backgroundColor:
                          visibility === value
                            ? colors.accentSoft
                            : colors.controlSurface,
                        borderColor:
                          visibility === value ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <SymbolView
                      name={value === 'private' ? 'lock' : 'globe'}
                      size={17}
                      tintColor={colors.text}
                    />
                    <Text style={{ color: colors.text }}>
                      {value === 'private' ? 'Private' : 'Public'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text
                style={{
                  color: colors.secondaryText,
                  fontSize: 13,
                  lineHeight: 19,
                }}
              >
                {visibility === 'public'
                  ? 'Visible on your Audius profile.'
                  : 'Hidden from your public Audius profile.'}
              </Text>
              {error ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: colors.accent, lineHeight: 21 }}
                >
                  {error}
                </Text>
              ) : null}
              <Text
                style={[styles.heading, { color: colors.text, marginTop: 10 }]}
              >
                {trackIds.length} tracks
              </Text>
              <Text style={{ color: colors.secondaryText }}>
                Use the arrows to change the order. Changes are saved together.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={styles.track}>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.text, fontWeight: '600' }}
                >
                  {songMap.get(item)?.title || 'Unavailable track'}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.secondaryText,
                    fontSize: 12,
                    marginTop: 3,
                  }}
                >
                  {songMap.get(item)?.creator ||
                    'Kept in your playlist unless you remove it'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${songMap.get(item)?.title || 'track'} up`}
                disabled={saving || index === 0}
                onPress={() => move(index, -1)}
                style={[
                  styles.icon,
                  (saving || index === 0) && { opacity: 0.3 },
                ]}
              >
                <SymbolView name="arrow.up" size={17} tintColor={colors.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Move ${songMap.get(item)?.title || 'track'} down`}
                disabled={saving || index === trackIds.length - 1}
                onPress={() => move(index, 1)}
                style={[
                  styles.icon,
                  (saving || index === trackIds.length - 1) && { opacity: 0.3 },
                ]}
              >
                <SymbolView
                  name="arrow.down"
                  size={17}
                  tintColor={colors.text}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${songMap.get(item)?.title || 'track'} from playlist`}
                disabled={saving}
                onPress={() =>
                  setTrackIds((current) =>
                    current.filter((_, position) => position !== index),
                  )
                }
                style={styles.icon}
              >
                <SymbolView
                  name="minus.circle"
                  size={20}
                  tintColor={colors.accent}
                />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <Text style={{ color: colors.secondaryText, paddingVertical: 16 }}>
              No tracks. Add songs from their menu after saving.
            </Text>
          }
          ListFooterComponent={
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={removePlaylist}
              style={[styles.deleteButton, { borderColor: colors.border }]}
            >
              <Text style={{ color: '#F17886', fontWeight: '700' }}>
                Delete playlist
              </Text>
            </Pressable>
          }
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  nav: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navAction: {
    minHeight: 44,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  input: {
    minHeight: 48,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    fontSize: 16,
  },
  privacy: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
  },
  track: { minHeight: 64, flexDirection: 'row', alignItems: 'center' },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    marginTop: 30,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
