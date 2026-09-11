import { SymbolView } from '@/components/app-symbol';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

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
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  const [hovered, setHovered] = useState(false);
  const duration = Math.max(0, Math.floor(song.duration || 0));

  if (desktop) {
    return (
      <View style={[styles.desktopShell, (hovered || active) && { backgroundColor: active ? colors.accentSoft : colors.controlSurface }]}>
        <Pressable accessibilityRole="button"
          accessibilityLabel={`${active ? 'Currently playing' : 'Play'} ${song.title} by ${song.creator}`}
          accessibilityState={{ selected: active }}
          onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
          onPress={onPress} onLongPress={onMenuPress} style={styles.desktopMain}>
          <View>
            <NowPlayingArtwork borderRadius={6} size={40} song={song} />
            {hovered && !active ? <View pointerEvents="none" style={styles.desktopPlayOverlay}>
              <SymbolView name="play.fill" size={16} tintColor="#FFFFFF" />
            </View> : null}
          </View>
          <View style={styles.copy}>
            <Text numberOfLines={1} style={[styles.desktopTitle, { color: active ? colors.accent : colors.text }]}>{song.title}</Text>
            <Text numberOfLines={1} style={[styles.artist, { color: colors.secondaryText }]}>{song.creator}</Text>
          </View>
          <DownloadStatusIcon trackId={song.id} />
          <Text style={[styles.desktopDuration, { color: colors.secondaryText }]}>{duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : '—'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`More options for ${song.title}`}
          onPress={onMenuPress} style={styles.desktopMenu}>
          <SymbolView name="ellipsis" size={20} tintColor={colors.secondaryText} />
        </Pressable>
      </View>
    );
  }

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
  desktopShell: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingLeft: 8 },
  desktopMain: { flex: 1, minWidth: 0, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  desktopTitle: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  desktopDuration: { fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 38, textAlign: 'right' },
  desktopMenu: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  desktopPlayOverlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: 6 },
  shell: { height: 56 },
  row: { backgroundColor: 'transparent', borderWidth: 0 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 44 },
  menuButton: { position: 'absolute', top: 8, right: -7.5, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  menuSymbol: { width: 25, height: 25 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 19, fontWeight: '500' },
  artist: { marginTop: 1, fontSize: 13, lineHeight: 16 },
});
