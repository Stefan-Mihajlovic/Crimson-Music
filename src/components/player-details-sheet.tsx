import { SymbolView } from 'expo-symbols';
import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, InteractionManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PlayerDetailsTabs from '@/components/player-details-tabs';
import { PlayerDetailsTab } from '@/components/player-details-tabs.types';
import PlayerLyricsView from '@/components/player-lyrics-view';
import NowPlayingArtwork from '@/components/now-playing-artwork';
import DownloadStatusIcon from '@/components/download-status-icon';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import {
  CrimsonSong,
  loadPlayerLyrics,
  loadRelatedSongs,
  PlayerLyrics,
  RelatedSong,
} from '@/services/music';

const emptyLyrics: PlayerLyrics = { karaoke: [], lyrics: [] };

export default function PlayerDetailsSheet({ initialTab = 'queue' }: { initialTab?: PlayerDetailsTab }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppSettings();
  const { currentSong, playSong, queue, source, sourceId } = usePlayer();
  const [tab, setTab] = useState<PlayerDetailsTab>(initialTab);
  const [lyrics, setLyrics] = useState<PlayerLyrics>(emptyLyrics);
  const [lyricsSongId, setLyricsSongId] = useState('');
  const [related, setRelated] = useState<RelatedSong[]>([]);
  const [relatedSongId, setRelatedSongId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentSong || tab === 'queue') return;
    const songId = currentSong.id;
    if (tab === 'lyrics' && lyricsSongId === songId) return;
    if (tab === 'related' && relatedSongId === songId) return;

    let active = true;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!active) return;
      setLoading(true);
      const request = tab === 'lyrics'
        ? loadPlayerLyrics(songId).then((result) => {
            if (!active) return;
            setLyrics(result);
            setLyricsSongId(songId);
          })
        : loadRelatedSongs(songId).then((result) => {
            if (!active) return;
            setRelated(result);
            setRelatedSongId(songId);
          });
      request
        .catch(() => {
          if (!active) return;
          if (tab === 'lyrics') {
            setLyrics(emptyLyrics);
            setLyricsSongId(songId);
          } else {
            setRelated([]);
            setRelatedSongId(songId);
          }
        })
        .finally(() => { if (active) setLoading(false); });
    });
    return () => {
      active = false;
      task.cancel();
    };
  }, [currentSong, lyricsSongId, relatedSongId, tab]);

  const playQueueSong = useCallback((song: CrimsonSong) => {
    playSong(song, queue, source, sourceId);
  }, [playSong, queue, source, sourceId]);

  const playRelatedSong = useCallback((song: RelatedSong) => {
    playSong(song, related, 'Related');
  }, [playSong, related]);

  if (!currentSong) {
    return <View style={[styles.screen, { backgroundColor: colors.elevated }]}><Text style={[styles.empty, { color: colors.secondaryText }]}>Nothing is playing.</Text></View>;
  }

  const loadedForCurrentSong = tab === 'lyrics' ? lyricsSongId === currentSong.id : relatedSongId === currentSong.id;

  return (
    <View style={[styles.screen, { backgroundColor: colors.elevated }]}>
      <PlayerDetailsTabs onChange={setTab} value={tab} />

      {tab === 'queue' ? (
        <FlatList
          alwaysBounceVertical
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          data={queue}
          initialNumToRender={10}
          keyExtractor={(song, index) => `${song.id}-${index}`}
          ListHeaderComponent={<View style={styles.sourceBlock}><Text style={[styles.overline, { color: colors.secondaryText }]}>Playing from</Text><Text style={[styles.source, { color: colors.text }]}>{source}</Text></View>}
          maxToRenderPerBatch={8}
          renderItem={({ item }) => (
            <PlayerSheetRow
              onPress={() => playQueueSong(item)}
              reason={item.creator}
              song={item}
            />
          )}
          showsVerticalScrollIndicator={false}
          updateCellsBatchingPeriod={40}
          windowSize={7}
        />
      ) : loading && !loadedForCurrentSong ? (
        <ActivityIndicator color={colors.accent} size="large" style={styles.loader} />
      ) : tab === 'lyrics' ? (
        <PlayerLyricsView karaoke={lyrics.karaoke} lyrics={lyrics.lyrics} />
      ) : (
        <FlatList
          alwaysBounceVertical
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
          data={related}
          initialNumToRender={8}
          keyExtractor={(song) => song.id}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.secondaryText }]}>No related songs found yet.</Text>}
          renderItem={({ item }) => (
            <PlayerSheetRow
              onPress={() => playRelatedSong(item)}
              reason={`${item.creator} · ${item.reason}`}
              song={item}
            />
          )}
          showsVerticalScrollIndicator={false}
          windowSize={7}
        />
      )}
    </View>
  );
}

const PlayerSheetRow = memo(function PlayerSheetRow({ onPress, reason, song }: { onPress: () => void; reason: string; song: CrimsonSong }) {
  const { currentSong, togglePlay } = usePlayer();
  return currentSong?.id === song.id
    ? <CurrentPlayerSheetRow onPress={togglePlay} reason={reason} song={song} />
    : <PlayerSheetRowContent onPress={onPress} reason={reason} song={song} />;
});

function CurrentPlayerSheetRow({ onPress, reason, song }: { onPress: () => void; reason: string; song: CrimsonSong }) {
  // Only the current row subscribes to live playback status.
  const { playing } = usePlayerStatus();
  return <PlayerSheetRowContent active playing={playing} onPress={onPress} reason={reason} song={song} />;
}

function PlayerSheetRowContent({ active = false, playing = false, onPress, reason, song }: {
  active?: boolean;
  playing?: boolean;
  onPress: () => void;
  reason: string;
  song: CrimsonSong;
}) {
  const { colors } = useAppSettings();
  return (
    <Pressable
      accessibilityLabel={`${active && playing ? 'Pause' : 'Play'} ${song.title} by ${song.creator}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, active && { backgroundColor: colors.accentSoft }, pressed && styles.rowPressed]}>
      <NowPlayingArtwork borderRadius={10} size={46} song={song} />
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: active ? colors.accent : colors.text }]}>{song.title}</Text>
        <Text numberOfLines={1} style={[styles.rowSubtitle, { color: colors.secondaryText }]}>{reason}</Text>
      </View>
      <DownloadStatusIcon trackId={song.id} />
      <SymbolView
        name={active && playing ? 'pause.fill' : 'play.fill'}
        size={active ? 18 : 14}
        tintColor={active ? colors.accent : colors.secondaryText}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden' },
  sourceBlock: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 13 },
  overline: { fontSize: 13 },
  source: { marginTop: 3, fontSize: 20, fontWeight: '800' },
  row: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(220,214,247,0.12)' },
  rowPressed: { backgroundColor: 'rgba(220,214,247,0.10)' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSubtitle: { marginTop: 2, fontSize: 13 },
  loader: { marginTop: 70 },
  empty: { padding: 24, fontSize: 15 },
});
