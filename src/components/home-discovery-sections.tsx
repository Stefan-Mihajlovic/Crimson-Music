import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import SongListRow from '@/components/song-list-row';
import { useAppSettings } from '@/providers/settings-provider';
import type { CrimsonSong } from '@/types/music';

type Props = {
  underground: CrimsonSong[];
  excludeTrackIds?: string[];
  contentWidth?: number;
  onPlaySong: (song: CrimsonSong, queue: CrimsonSong[], source: string) => void;
  onSongMenu: (song: CrimsonSong) => void;
};

export default function HomeDiscoverySections({ underground, excludeTrackIds = [], contentWidth = 0, onPlaySong, onSongMenu }: Props) {
  const { colors } = useAppSettings();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  const availableWidth = contentWidth || Math.max(280, width - (desktop ? 376 : 40));
  const seen = new Set(excludeTrackIds);
  const discoveries: CrimsonSong[] = [];
  for (const song of underground) {
    if (!song.id || !song.streamable || seen.has(song.id)) continue;
    seen.add(song.id);
    discoveries.push(song);
    if (discoveries.length === 8) break;
  }

  if (!discoveries.length) return null;
  return <View style={styles.section}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Underground gems</Text>
      <Text style={[styles.subtitle, { color: colors.secondaryText }]}>A little further from the mainstream</Text>
    </View>
    <View style={[styles.songList, desktop && styles.songGrid]}>
      {discoveries.map((song) => <View key={song.id} style={desktop && { width: (availableWidth - 24) / 2 }}>
        <SongListRow song={song} onPress={() => onPlaySong(song, discoveries, 'Underground gems')} onMenuPress={() => onSongMenu(song)} />
      </View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 30 },
  heading: { gap: 4, marginBottom: 14 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '700', letterSpacing: -0.45 },
  subtitle: { fontSize: 12, lineHeight: 17 },
  songList: { gap: 8 },
  songGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 },
});
