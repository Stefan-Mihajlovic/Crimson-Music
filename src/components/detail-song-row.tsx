import { SymbolView } from '@/components/app-symbol';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

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
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  const [hovered, setHovered] = useState(false);
  const duration = Math.max(0, Math.floor(song.duration || 0));
  const menu = (
      <BouncyPressable
        accessibilityLabel={`More options for ${song.title}`}
        accessibilityRole="button"
        hitSlop={9}
        onPress={(event) => {
          event.stopPropagation();
          onLongPress();
        }}
        style={[styles.menu, Platform.OS === 'web' && [styles.webMenu, { top: desktop ? 8 : 12 }]]}>
        <SymbolView name="ellipsis" size={20} style={styles.menuSymbol} tintColor={colors.secondaryText} weight="semibold" />
      </BouncyPressable>
  );
  const row = (
    <Pressable
      accessibilityLabel={`${active ? 'Currently playing' : 'Play'} ${song.title} by ${song.creator}`}
      accessibilityRole="button"
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityState={{ selected: active }}
      delayLongPress={350}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        desktop && styles.desktopRow,
        Platform.OS === 'web' && styles.webPlayRow,
        desktop && hovered && { backgroundColor: colors.controlSurface },
        active && { backgroundColor: colors.accentSoft },
        pressed && [styles.pressed, { backgroundColor: colors.accentSoft }],
        pressed && !reduceMotion && styles.pressedScale,
      ]}>
      <NowPlayingArtwork borderRadius={desktop ? 6 : 10} size={desktop ? 40 : 50} song={song} />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, desktop && styles.desktopTitle, { color: active ? colors.accent : colors.text }]}>{song.title}</Text>
        <Text numberOfLines={1} style={[styles.subtitle, { color: colors.secondaryText }]}>{song.creator}</Text>
      </View>
      <DownloadStatusIcon
        expectedOffline={expectedOffline}
        trackId={song.id}
        unavailableForOffline={unavailableForOffline}
      />
      {desktop ? <Text style={[styles.desktopDuration, { color: colors.secondaryText }]}>{duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : '—'}</Text> : null}
      {Platform.OS !== 'web' ? menu : null}
    </Pressable>
  );
  return Platform.OS === 'web' ? <View style={styles.webShell}>{row}{menu}</View> : row;
}

const styles = StyleSheet.create({
  webShell: { position: 'relative' },
  webPlayRow: { paddingRight: 63 },
  webMenu: { position: 'absolute', right: 10 },
  desktopRow: { minHeight: 58, borderRadius: 8, gap: 14 },
  desktopTitle: { fontSize: 14, lineHeight: 19 },
  desktopDuration: { fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 45, textAlign: 'right' },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 10, borderRadius: 16 },
  pressed: { backgroundColor: 'rgba(185,129,255,0.12)' },
  pressedScale: { transform: [{ scale: 0.99 }] },
  copy: { flex: 1, minWidth: 0 },
  title: { color: '#F1ECFF', fontSize: 16, fontWeight: '600' },
  subtitle: { marginTop: 2, color: '#918A9D', fontSize: 13 },
  menu: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  menuSymbol: { width: 25, height: 25 },
});
