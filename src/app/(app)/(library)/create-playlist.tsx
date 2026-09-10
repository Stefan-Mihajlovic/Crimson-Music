import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { useDetailRoutes } from '@/services/action-sheet';
import { createOwnedPlaylist, setSongInOwnedPlaylist } from '@/services/music';
import { requestLibraryRefresh } from '@/services/navigation-events';

const defaultArtwork = require('@/assets/images/home/default-song.webp');

export default function CreatePlaylistScreen() {
  const router = useRouter();
  const { playlistHref } = useDetailRoutes();
  const { trackId } = useLocalSearchParams<{ trackId?: string }>();
  const { user } = useAuth();
  const { colors, reduceMotion } = useAppSettings();
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const focusTimer = setTimeout(
      () => titleInputRef.current?.focus(),
      reduceMotion ? 0 : 450,
    );
    return () => clearTimeout(focusTimer);
  }, [reduceMotion]);

  const createPlaylist = async () => {
    if (!user?.uid || saving) return;
    if (!title.trim()) {
      Alert.alert(
        'Playlist name required',
        'Enter a name for your new playlist.',
      );
      return;
    }
    setSaving(true);
    try {
      const playlist = await createOwnedPlaylist(user.uid, title, undefined, {
        visibility,
      });
      let songAdded = true;
      if (trackId) {
        try {
          await setSongInOwnedPlaylist(user.uid, playlist.id, trackId);
        } catch {
          songAdded = false;
        }
      }
      requestLibraryRefresh();
      router.replace(
        playlistHref(playlist.id, true, playlist.source, playlist.title),
      );
      if (!songAdded) {
        setTimeout(
          () =>
            Alert.alert(
              'Playlist created',
              'The playlist was created, but the song could not be added. Try again from the song menu.',
            ),
          250,
        );
      }
    } catch (error) {
      Alert.alert(
        'Could not create playlist',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <Stack.Screen
        options={{
          title: 'New Playlist',
          headerLargeTitle: false,
          headerRight: () => (
            <Pressable
              accessibilityLabel="Create playlist"
              disabled={saving || !title.trim()}
              onPress={() => void createPlaylist()}
              style={styles.headerAction}
            >
              {saving ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text
                  style={[
                    styles.headerActionText,
                    { color: colors.accent },
                    !title.trim() && styles.headerActionDisabled,
                  ]}
                >
                  Create
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView
        alwaysBounceVertical
        bounces
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.coverButton}>
          <Image
            contentFit="cover"
            source={defaultArtwork}
            style={styles.cover}
          />
        </View>

        <Text
          style={[styles.previewTitle, { color: colors.text }]}
          numberOfLines={2}
        >
          {title.trim() || 'Playlist Name'}
        </Text>

        <View
          style={[styles.formGroup, { backgroundColor: colors.controlSurface }]}
        >
          <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>
            NAME
          </Text>
          <TextInput
            maxLength={80}
            onChangeText={setTitle}
            placeholder="My Playlist"
            placeholderTextColor={colors.mutedText}
            returnKeyType="done"
            ref={titleInputRef}
            style={[styles.input, { color: colors.text }]}
            value={title}
            onSubmitEditing={() => void createPlaylist()}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            marginTop: 16,
            width: '100%',
          }}
        >
          {(['public', 'private'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: visibility === value }}
              disabled={saving}
              onPress={() => setVisibility(value)}
              style={{
                flex: 1,
                minHeight: 46,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 23,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor:
                  visibility === value ? colors.accent : colors.border,
                backgroundColor:
                  visibility === value
                    ? colors.accentSoft
                    : colors.controlSurface,
              }}
            >
              <Text style={{ color: colors.text }}>
                {value === 'public' ? 'Public' : 'Private'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.help, { color: colors.secondaryText }]}>
          {visibility === 'public'
            ? 'Visible on your Audius profile.'
            : 'Hidden from your public Audius profile.'}{' '}
          Add songs from any song menu. You can rename, reorder tracks, and
          change visibility from Edit playlist.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E0D13' },
  content: {
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 80,
  },
  headerAction: { paddingHorizontal: 2, paddingVertical: 4 },
  headerActionText: { color: '#A97AFF', fontSize: 16, fontWeight: '700' },
  headerActionDisabled: { opacity: 0.38 },
  coverButton: {
    width: 176,
    height: 176,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#211C28',
  },
  cover: { width: '100%', height: '100%' },
  previewTitle: {
    minHeight: 38,
    marginTop: 18,
    color: '#F1ECFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  formGroup: {
    width: '100%',
    marginTop: 28,
    overflow: 'hidden',
    borderRadius: 15,
    backgroundColor: '#1B1820',
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  fieldLabel: {
    color: '#8F879B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  input: { height: 48, color: '#F1ECFF', fontSize: 16 },
  help: {
    width: '100%',
    marginTop: 10,
    color: '#777188',
    fontSize: 12,
    lineHeight: 17,
  },
});
