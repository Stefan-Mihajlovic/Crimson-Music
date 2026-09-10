import { Href, Stack, useRouter, useSegments } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { useDownloads } from '@/providers/download-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { DOWNLOAD_MAX_BYTES, DOWNLOAD_MIN_BYTES } from '@/services/downloads';

const megabyte = 1024 * 1024;
const gigabyte = 1024 * megabyte;

function formatStorage(bytes: number) {
  if (bytes < gigabyte) return `${Math.round(bytes / megabyte)} MB`;
  const value = bytes / gigabyte;
  return `${value.toFixed(value >= 2.95 || Number.isInteger(value) ? 0 : 1)} GB`;
}

function storageBytesForPosition(position: number, width: number) {
  const ratio = Math.max(0, Math.min(1, position / Math.max(1, width)));
  const rawBytes = DOWNLOAD_MIN_BYTES + ratio * (DOWNLOAD_MAX_BYTES - DOWNLOAD_MIN_BYTES);
  const step = 50 * megabyte;
  return ratio > 0.985
    ? DOWNLOAD_MAX_BYTES
    : Math.max(DOWNLOAD_MIN_BYTES, Math.min(DOWNLOAD_MAX_BYTES, Math.round(rawBytes / step) * step));
}

export default function OfflineListeningSettingsScreen() {
  const router = useRouter();
  const segments = useSegments();
  const accountTab = segments.some((segment) => String(segment) === '(account)');
  const downloads = useDownloads();
  const { colors } = useAppSettings();
  const [storageSliderDragging, setStorageSliderDragging] = useState(false);
  const controlsDisabled = !downloads.supported || !downloads.enabled;

  const confirmClearOfflineMusic = () => {
    if (!downloads.downloadedCount) return;
    Alert.alert(
      'Remove all offline music?',
      `This removes ${downloads.downloadedCount} offline ${downloads.downloadedCount === 1 ? 'song' : 'songs'} from this device.${downloads.automatic ? ' Automatic Offline Listening will remain on and may save them again later.' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Offline Music',
          style: 'destructive',
          onPress: () => void downloads.clearAllDownloads(),
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          fullScreenGestureEnabled: false,
          gestureEnabled: !storageSliderDragging,
          headerShadowVisible: false,
          title: 'Offline Listening Settings',
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        directionalLockEnabled
        showsVerticalScrollIndicator={false}>
        {!downloads.enabled ? (
          <View style={[styles.notice, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
            <SymbolView name="icloud.slash" size={20} tintColor={colors.accent} />
            <Text style={[styles.noticeText, { color: colors.secondaryText }]}>
              Turn on Offline Listening from the main Settings page to change these options.
            </Text>
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>AUTOMATION</Text>
        <View style={[styles.group, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
          <SettingsToggle
            disabled={controlsDisabled}
            icon="wand.and.stars"
            title="Automatic Offline Listening"
            subtitle="Keeps Favorites and up to three of your most-listened playlists offline."
            value={downloads.automatic}
            onValueChange={downloads.setAutomatic}
          />
          <Divider />
          <SettingsToggle
            disabled={controlsDisabled}
            icon="wifi"
            title="Save over Wi-Fi only"
            subtitle="Prevents offline saving from using cellular data."
            value={downloads.wifiOnly}
            onValueChange={downloads.setWifiOnly}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>STORAGE & MUSIC</Text>
        <View style={[styles.group, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}>
          <StorageLimitSlider
            key={downloads.maxBytes}
            disabled={controlsDisabled}
            maxBytes={downloads.maxBytes}
            onDragChange={setStorageSliderDragging}
            onValueChange={downloads.setMaxBytes}
            usedBytes={downloads.usedBytes}
          />
          <Divider />
          <SettingsLink
            disabled={!downloads.supported}
            icon="music.note.list"
            title="Available Offline"
            subtitle={downloads.ready
              ? downloads.downloadedCount
                ? `Open ${downloads.downloadedCount} offline ${downloads.downloadedCount === 1 ? 'song' : 'songs'}.`
                : 'No songs are currently stored offline.'
              : 'Loading saved music…'}
            onPress={() => router.push((accountTab ? '/(app)/(account)/offline-listening' : '/(app)/(home)/offline-listening') as Href)}
          />
          <Divider />
          <SettingsLink
            destructive
            disabled={!downloads.supported || !downloads.downloadedCount}
            icon="trash"
            title="Remove All Offline Music"
            subtitle={downloads.downloadedCount
              ? `Remove ${downloads.downloadedCount} offline ${downloads.downloadedCount === 1 ? 'song' : 'songs'} from this device.`
              : 'No songs are currently stored offline.'}
            onPress={confirmClearOfflineMusic}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Divider() {
  const { colors } = useAppSettings();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function SettingsToggle({
  disabled,
  icon,
  onValueChange,
  subtitle,
  title,
  value,
}: {
  disabled?: boolean;
  icon: SymbolViewProps['name'];
  onValueChange: (value: boolean) => void;
  subtitle: string;
  title: string;
  value: boolean;
}) {
  const { colors } = useAppSettings();
  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <SymbolView name={icon} size={21} tintColor={colors.accent} />
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text>
      </View>
      <Switch
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surfaceStrong, true: colors.accent }}
        value={value}
      />
    </View>
  );
}

function SettingsLink({
  destructive = false,
  disabled,
  icon,
  onPress,
  subtitle,
  title,
}: {
  destructive?: boolean;
  disabled?: boolean;
  icon: SymbolViewProps['name'];
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  const { colors } = useAppSettings();
  const tint = destructive ? '#FF6476' : colors.accent;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        disabled && styles.disabled,
        pressed && { backgroundColor: destructive ? 'rgba(255,100,118,0.09)' : colors.accentSoft },
      ]}>
      <SymbolView name={icon} size={21} tintColor={tint} />
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, { color: destructive ? tint : colors.text }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text>
      </View>
      <SymbolView name="chevron.right" size={15} tintColor={destructive ? tint : colors.mutedText} weight="semibold" />
    </Pressable>
  );
}

function StorageLimitSlider({
  disabled,
  maxBytes,
  onDragChange,
  onValueChange,
  usedBytes,
}: {
  disabled?: boolean;
  maxBytes: number;
  onDragChange: (dragging: boolean) => void;
  onValueChange: (value: number) => void;
  usedBytes: number;
}) {
  const { colors } = useAppSettings();
  const [draftBytes, setDraftBytes] = useState(maxBytes);
  const [sliderWidth, setSliderWidth] = useState(1);
  const panHandlers = useMemo(() => {
    const updateFromPosition = (position: number) => {
      if (disabled) return;
      setDraftBytes(storageBytesForPosition(position, sliderWidth));
    };
    const finishDragging = (position: number) => {
      const next = storageBytesForPosition(position, sliderWidth);
      setDraftBytes(next);
      onDragChange(false);
      onValueChange(next);
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponderCapture: () => !disabled,
      onPanResponderGrant: (event) => {
        onDragChange(true);
        updateFromPosition(event.nativeEvent.locationX);
      },
      onPanResponderMove: (event) => updateFromPosition(event.nativeEvent.locationX),
      onPanResponderRelease: (event) => finishDragging(event.nativeEvent.locationX),
      onPanResponderTerminate: (event) => finishDragging(event.nativeEvent.locationX),
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onStartShouldSetPanResponder: () => !disabled,
      onStartShouldSetPanResponderCapture: () => !disabled,
    }).panHandlers;
  }, [disabled, onDragChange, onValueChange, sliderWidth]);
  const ratio = (draftBytes - DOWNLOAD_MIN_BYTES) / (DOWNLOAD_MAX_BYTES - DOWNLOAD_MIN_BYTES);

  return (
    <View style={[styles.storageLimit, disabled && styles.disabled]}>
      <View style={styles.storageHeader}>
        <SymbolView name="internaldrive.fill" size={21} tintColor={colors.accent} />
        <View style={styles.rowCopy}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>Storage Limit</Text>
          <Text style={[styles.rowSubtitle, { color: colors.secondaryText }]}>
            {formatStorage(usedBytes)} used of {formatStorage(draftBytes)}
          </Text>
        </View>
        <Text style={[styles.storageValue, { color: colors.accent }]}>{formatStorage(draftBytes)}</Text>
      </View>
      <View
        accessible
        accessibilityActions={[
          { name: 'increment', label: 'Increase storage limit' },
          { name: 'decrement', label: 'Decrease storage limit' },
        ]}
        accessibilityLabel="Offline listening storage limit"
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: Math.round(DOWNLOAD_MIN_BYTES / megabyte),
          max: Math.round(DOWNLOAD_MAX_BYTES / megabyte),
          now: Math.round(draftBytes / megabyte),
          text: formatStorage(draftBytes),
        }}
        onAccessibilityAction={(event) => {
          const direction = event.nativeEvent.actionName === 'increment' ? 1 : -1;
          const next = Math.max(
            DOWNLOAD_MIN_BYTES,
            Math.min(DOWNLOAD_MAX_BYTES, draftBytes + direction * 50 * megabyte),
          );
          setDraftBytes(next);
          onValueChange(next);
        }}
        onLayout={(event) => setSliderWidth(Math.max(1, event.nativeEvent.layout.width))}
        {...panHandlers}
        style={styles.slider}>
        <View style={[styles.sliderTrack, { backgroundColor: colors.surfaceStrong }]}>
          <View style={[styles.sliderFill, { backgroundColor: colors.accent, width: `${ratio * 100}%` }]} />
          <View style={[styles.sliderThumb, { backgroundColor: colors.text, borderColor: colors.accent, left: `${ratio * 100}%` }]} />
        </View>
      </View>
      <View style={styles.sliderLabels}>
        <Text style={[styles.sliderLabel, { color: colors.mutedText }]}>100 MB</Text>
        <Text style={[styles.sliderLabel, { color: colors.mutedText }]}>4 GB</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 160 },
  notice: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  sectionLabel: { marginTop: 26, marginBottom: 8, marginLeft: 14, fontSize: 12, fontWeight: '600' },
  group: { overflow: 'hidden', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 10 },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSubtitle: { marginTop: 3, fontSize: 12, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 50 },
  disabled: { opacity: 0.5 },
  storageLimit: { paddingHorizontal: 16, paddingTop: 13, paddingBottom: 14 },
  storageHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 13 },
  storageValue: { fontSize: 14, fontWeight: '800' },
  slider: { height: 38, justifyContent: 'center', marginLeft: 34, marginRight: 2 },
  sliderTrack: { height: 5, borderRadius: 3 },
  sliderFill: { height: 5, borderRadius: 3 },
  sliderThumb: { position: 'absolute', top: -7, width: 19, height: 19, marginLeft: -9, borderRadius: 10, borderWidth: 3 },
  sliderLabels: { marginLeft: 34, flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontSize: 10, fontWeight: '600' },
});
