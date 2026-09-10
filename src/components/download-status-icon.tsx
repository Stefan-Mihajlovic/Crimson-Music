import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useDownloads } from '@/providers/download-provider';
import { useAppSettings } from '@/providers/settings-provider';

export default function DownloadStatusIcon({
  expectedOffline = false,
  trackId,
  unavailableForOffline = false,
}: {
  expectedOffline?: boolean;
  trackId: string;
  unavailableForOffline?: boolean;
}) {
  const { statusFor } = useDownloads();
  const { colors } = useAppSettings();
  const status = statusFor(trackId);

  if (status.state === 'not-downloaded') {
    if (!expectedOffline || !unavailableForOffline) return null;
    return (
      <SymbolView
        accessibilityLabel="Unavailable for offline listening"
        name="icloud.slash.fill"
        size={17}
        tintColor={colors.mutedText}
      />
    );
  }
  if (status.state === 'downloading') {
    return (
      <View
        accessibilityLabel={`Saving for offline listening, ${Math.round(status.progress * 100)} percent`}
        style={styles.downloading}>
        <ActivityIndicator color={colors.accent} size={19} style={StyleSheet.absoluteFill} />
        <SymbolView name="arrow.down" size={8} tintColor={colors.accent} weight="bold" />
      </View>
    );
  }
  if (status.state === 'error') {
    return (
      <SymbolView
        accessibilityLabel="Could not save for offline listening"
        name="exclamationmark.triangle.fill"
        size={17}
        tintColor="#FF9B68"
      />
    );
  }
  return (
    <SymbolView
      accessibilityLabel="Available for offline listening"
      name="checkmark.circle.fill"
      size={18}
      tintColor={colors.accent}
    />
  );
}

const styles = StyleSheet.create({
  downloading: {
    width: 19,
    height: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
