import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { profileImageSource } from '@/components/profile-images';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { useAppSettings } from '@/providers/settings-provider';
import type { CrimsonUser } from '@/services/auth';
import { PROFILE_NAME_MAX_LENGTH, PROFILE_PHOTO_MAX_BYTES, type ProfilePhotoUpload } from '@/services/audius-profile';
import { getCurrentAudiusUserId } from '@/services/audius-session';

export default function EditProfileScreen() {
  const { user } = useAuth();
  // A different account starts a fresh draft and invalidates pending picker/save callbacks.
  return user ? <ProfileEditor key={user.uid} user={user} /> : null;
}

function ProfileEditor({ user }: { user: CrimsonUser }) {
  const { updateProfile, signInWithAudius } = useAuth();
  const { colors } = useAppSettings();
  const { isOffline } = useNetwork();
  const router = useRouter();
  const [name, setName] = useState(user.DisplayName || user.Username);
  const [photo, setPhoto] = useState<ProfilePhotoUpload>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const active = useRef(true);
  const mounted = useRef(true);
  const pickerRevision = useRef(0);
  const savePending = useRef(false);
  const readOnly = !user.CanWrite;
  const busy = saving || picking || connecting;
  const cleanName = name.trim();
  const changed = !!photo || cleanName !== (user.DisplayName || user.Username);
  const canSave = changed && !!cleanName && !busy && !isOffline && !readOnly;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useFocusEffect(useCallback(() => {
    active.current = true;
    setPicking(false);
    return () => {
      active.current = false;
      pickerRevision.current += 1;
    };
  }, []));

  const stillCurrent = () => mounted.current && getCurrentAudiusUserId() === user.uid;

  const choosePhoto = async () => {
    if (busy || readOnly) return;
    const revision = ++pickerRevision.current;
    setError(undefined);
    // Some web browsers never resolve a dismissed picker. Keep the form usable there.
    if (Platform.OS !== 'web') setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: Platform.OS !== 'web',
        aspect: [1, 1],
        quality: 0.9,
      });
      if (!stillCurrent() || revision !== pickerRevision.current || result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      const size = asset.file?.size ?? asset.fileSize;
      if (size !== undefined && (!Number.isFinite(size) || size <= 0 || size > PROFILE_PHOTO_MAX_BYTES)) {
        setError(`Choose a photo smaller than ${PROFILE_PHOTO_MAX_BYTES / (1024 * 1024)} MB.`);
        return;
      }
      const fileName = asset.file?.name || asset.fileName || asset.uri.split('/').pop()?.split('?')[0] || 'profile-photo.jpg';
      const extension = fileName.split('.').pop()?.toLowerCase();
      const fallbackType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : extension === 'gif' ? 'image/gif' : extension === 'heic' ? 'image/heic' : extension === 'heif' ? 'image/heif' : 'image/jpeg';
      setPhoto({
        uri: asset.uri,
        name: fileName,
        type: asset.file?.type || asset.mimeType || fallbackType,
        file: asset.file,
        size,
      });
    } catch {
      if (stillCurrent() && revision === pickerRevision.current) setError('Could not open this photo. Please choose another image.');
    } finally {
      if (stillCurrent() && revision === pickerRevision.current) setPicking(false);
    }
  };

  const save = async () => {
    if (!canSave || savePending.current) return;
    Keyboard.dismiss();
    savePending.current = true;
    pickerRevision.current += 1;
    setSaving(true);
    setError(undefined);
    try {
      await updateProfile({ name: cleanName, ...(photo ? { photo } : {}) });
      if (stillCurrent() && active.current) router.back();
    } catch (cause) {
      if (stillCurrent()) setError(cause instanceof Error ? cause.message : 'Could not save your profile. Please try again.');
    } finally {
      savePending.current = false;
      if (stillCurrent()) setSaving(false);
    }
  };

  const reconnect = async () => {
    if (busy || isOffline) return;
    setConnecting(true);
    setError(undefined);
    try {
      await signInWithAudius();
    } catch (cause) {
      if (stillCurrent()) setError(cause instanceof Error ? cause.message : 'Could not reconnect to Audius. Please try again.');
    } finally {
      if (stillCurrent()) setConnecting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Edit profile', gestureEnabled: !saving, headerBackVisible: !saving }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.photoSection}>
            <Image
              accessibilityLabel="Profile photo preview"
              source={photo ? { uri: photo.uri } : profileImageSource(user.ProfilePhoto || '1')}
              contentFit="cover"
              style={[styles.photo, { borderColor: colors.accent }]}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" disabled={busy || readOnly} onPress={() => void choosePhoto()} style={({ pressed }) => [styles.photoButton, { backgroundColor: colors.accentSoft }, (busy || readOnly) && styles.disabled, pressed && styles.pressed]}>
              {picking ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={[styles.buttonText, { color: colors.accent }]}>Change photo</Text>}
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text nativeID="profile-name-label" style={[styles.label, { color: colors.text }]}>Display name</Text>
            <TextInput
              accessibilityLabel="Display name"
              accessibilityLabelledBy="profile-name-label"
              value={name}
              onChangeText={(value) => { setName(value); setError(undefined); }}
              editable={!busy && !readOnly}
              maxLength={PROFILE_NAME_MAX_LENGTH}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              returnKeyType="done"
              onSubmitEditing={() => void save()}
              placeholder="Your name"
              placeholderTextColor={colors.mutedText}
              selectionColor={colors.accent}
              style={[styles.input, { color: colors.text, backgroundColor: colors.controlSurface, borderColor: colors.border }, readOnly && styles.disabled]}
            />
            <Text style={[styles.handle, { color: colors.secondaryText }]}>@{user.Username}</Text>
          </View>
          <Text style={[styles.note, { color: colors.secondaryText }]}>Changes update your Audius profile.</Text>

          {isOffline && <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.text, backgroundColor: colors.controlSurface }]}>You’re offline. Connect to the internet to save your changes.</Text>}
          {readOnly && <View style={[styles.feedback, { backgroundColor: colors.controlSurface }]}>
            <Text style={[styles.note, { color: colors.text }]}>Reconnect to Audius to allow Crimson to edit your profile.</Text>
            <Pressable accessibilityRole="button" disabled={busy || isOffline} onPress={() => void reconnect()} style={({ pressed }) => [styles.reconnectButton, (busy || isOffline) && styles.disabled, pressed && styles.pressed]}>
              {connecting ? <ActivityIndicator color={colors.accent} /> : <Text style={[styles.buttonText, { color: colors.accent }]}>Reconnect Audius</Text>}
            </Pressable>
          </View>}
          {!!error && <Text accessibilityRole="alert" style={[styles.feedback, { color: colors.text, backgroundColor: colors.accentSoft }]}>{error}</Text>}

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Save profile" accessibilityState={{ disabled: !canSave, busy: saving }} disabled={!canSave} onPress={() => void save()} style={({ pressed }) => [styles.saveButton, !canSave && styles.disabled, pressed && styles.pressed]}>
              {saving ? <ActivityIndicator color="#171020" /> : null}
              <Text style={[styles.buttonText, styles.saveText]}>{saving ? 'Saving…' : 'Save changes'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.back()} style={({ pressed }) => [styles.cancelButton, busy && styles.disabled, pressed && styles.pressed]}>
              <Text style={[styles.buttonText, { color: colors.secondaryText }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 150 },
  form: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 20 },
  photoSection: { alignItems: 'center', gap: 18, paddingBottom: 12 },
  photo: { width: 132, height: 132, borderRadius: 66, borderWidth: 2 },
  photoButton: { minHeight: 44, minWidth: 150, paddingHorizontal: 20, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fieldGroup: { gap: 10 },
  label: { fontSize: 15, fontWeight: '600' },
  input: { minHeight: 54, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, paddingHorizontal: 16, fontSize: 17 },
  handle: { fontSize: 15, paddingHorizontal: 2 },
  note: { fontSize: 14, lineHeight: 21 },
  feedback: { borderRadius: 16, padding: 16, fontSize: 14, lineHeight: 21 },
  reconnectButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 8 },
  actions: { gap: 8, marginTop: 4 },
  saveButton: { minHeight: 54, borderRadius: 27, backgroundColor: '#FFFFFF', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  saveText: { color: '#171020' },
  cancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
