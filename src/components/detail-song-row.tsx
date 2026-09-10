import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CrimsonSong } from '@/services/music';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import BouncyPressable from '@/components/bouncy-pressable';
import DownloadStatusIcon from '@/components/download-status-icon';
import NowPlayingArtwork from '@/components/now-playing-artwork';

export default function DetailSongRow({
  expectedOffline,
  onLongPress,
  onPress,
  song,
  unavailableForOffline,
}: {
  expectedOffline?: boolean;
  onLongPress: () => void;
  onPress: () => void;
  song: CrimsonSong;
  unavailableForOffline?: boolean;
}) {
  const { currentSong } = usePlayer();
  const { colors, reduceMotion } = useAppSettings();
  const active = currentSong?.id === song.id;
  return (
    <Pressable
      accessibilityLabel={`${active ? 'Currently playing' : 'Play'} ${song.title} by ${song.creator}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      delayLongPress={350}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        active && { backgroundColor: colors.accentSoft },
        pressed && [styles.pressed, { backgroundColor: colors.accentSoft }],
        pressed && !reduceMotion && styles.pressedScale,
      ]}>
      <NowPlayingArtwork borderRadius={10} size={50} song={song} />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, { color: active ? colors.accent : colors.text }]}>{song.title}</Text>
        <Text numberOfLines={1} style={[styles.subtitle, { color: colors.secondaryText }]}>{song.creator}</Text>
      </View>
      <DownloadStatusIcon
        expectedOffline={expectedOffline}
        trackId={song.id}
        unavailableForOffline={unavailableForOffline}
      />
      <BouncyPressable
        accessibilityLabel={`More options for ${song.title}`}
        accessibilityRole="button"
        hitSlop={9}
        onPress={(event) => {
          event.stopPropagation();
          onLongPress();
        }}
        style={styles.menu}>
        <SymbolView name="ellipsis" size={20} style={styles.menuSymbol} tintColor={colors.secondaryText} weight="semibold" />
      </BouncyPressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 10, borderRadius: 16 },
  pressed: { backgroundColor: 'rgba(185,129,255,0.12)' },
  pressedScale: { transform: [{ scale: 0.99 }] },
  copy: { flex: 1, minWidth: 0 },
  title: { color: '#F1ECFF', fontSize: 16, fontWeight: '600' },
  subtitle: { marginTop: 2, color: '#918A9D', fontSize: 13 },
  menu: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  menuSymbol: { width: 25, height: 25 },
});
