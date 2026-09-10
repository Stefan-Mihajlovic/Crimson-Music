import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import BouncyPressable from '@/components/bouncy-pressable';
import DownloadStatusIcon from '@/components/download-status-icon';
import GlassPressable from '@/components/glass-pressable';
import NowPlayingArtwork from '@/components/now-playing-artwork';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { CrimsonSong } from '@/services/music';

export default function SongListRow({
  onMenuPress,
  onPress,
  song,
}: {
  onMenuPress: () => void;
  onPress: () => void;
  song: CrimsonSong;
}) {
  const { currentSong } = usePlayer();
  const { colors } = useAppSettings();
  const active = currentSong?.id === song.id;

  return (
    <View style={styles.shell}>
      <GlassPressable
        accessibilityLabel={`${active ? 'Currently playing' : 'Play'} ${song.title} by ${song.creator}`}
        cornerRadius={16}
        delayLongPress={350}
        height={56}
        onLongPress={onMenuPress}
        onPress={onPress}
        style={styles.row}
        contentStyle={styles.content}>
        <NowPlayingArtwork borderRadius={8} size={42} song={song} />
        <View style={styles.copy}>
          <Text numberOfLines={1} style={[styles.title, { color: active ? colors.accent : colors.text }]}>{song.title}</Text>
          <Text numberOfLines={1} style={[styles.artist, { color: colors.secondaryText }]}>{song.creator}</Text>
        </View>
        <DownloadStatusIcon trackId={song.id} />
      </GlassPressable>
      <BouncyPressable
        accessibilityLabel={`More options for ${song.title}`}
        accessibilityRole="button"
        hitSlop={6}
        onPress={onMenuPress}
        style={styles.menuButton}>
        <SymbolView name="ellipsis" size={20} style={styles.menuSymbol} tintColor={colors.secondaryText} weight="semibold" />
      </BouncyPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { height: 56 },
  row: { backgroundColor: 'transparent', borderWidth: 0 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 44 },
  menuButton: { position: 'absolute', top: 8, right: -7.5, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  menuSymbol: { width: 25, height: 25 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 19, fontWeight: '500' },
  artist: { marginTop: 1, fontSize: 13, lineHeight: 16 },
});
