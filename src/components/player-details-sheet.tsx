import { SymbolView } from '@/components/app-symbol';
import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PlayerDetailsTabs from '@/components/player-details-tabs';
import { POPUP_CLOSE_CLEARANCE, POPUP_MOBILE_INSET } from '@/components/popup-layout';
import ReorderableQueue, { type QueueEntry } from '@/components/reorderable-queue';
import { PlayerDetailsTab } from '@/components/player-details-tabs.types';
import NowPlayingArtwork from '@/components/now-playing-artwork';
import DownloadStatusIcon from '@/components/download-status-icon';
import SongListRow from '@/components/song-list-row';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { CrimsonSong, loadRelatedSongs, RelatedSong } from '@/services/music';
import { actionSheetHref } from '@/services/action-sheet';

export default function PlayerDetailsSheet({ initialTab = 'queue' }: { initialTab?: PlayerDetailsTab }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppSettings();
  const { currentSong, playSong, queue, queueIndex, source, autoplayEnabled, toggleAutoplay,
    playQueueIndex, removeFromQueue, moveQueueItem } = usePlayer();
  const [tab, setTab] = useState<PlayerDetailsTab>(initialTab === 'lyrics' ? 'queue' : initialTab);
  const [related, setRelated] = useState<RelatedSong[]>([]);
  const [loadedRequest, setLoadedRequest] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const songId = currentSong?.id;
  const requestKey = `${songId || ''}:${revision}`;
  const loading = tab === 'related' && loadedRequest !== requestKey;

  useEffect(() => {
    if (!songId || tab !== 'related') return;
    let active = true;
    void loadRelatedSongs(songId).then((songs) => {
      if (active) { setRelated(songs); setError(''); }
    }).catch(() => {
      if (active) setError('Related music could not be loaded.');
    }).finally(() => { if (active) setLoadedRequest(requestKey); });
    return () => { active = false; };
  }, [songId, tab, requestKey]);

  const items = useMemo<QueueEntry[]>(() => {
    const occurrences = new Map<string, number>();
    return queue.map((song, index) => {
      const occurrence = occurrences.get(song.id) || 0;
      occurrences.set(song.id, occurrence + 1);
      return { song, index, key: `${song.id}:${occurrence}` };
    }).slice(queueIndex + 1);
  }, [queue, queueIndex]);

  if (!currentSong) return <ScrollView style={styles.list}><Text style={[styles.empty, Platform.OS === 'web' && { paddingRight: POPUP_MOBILE_INSET + POPUP_CLOSE_CLEARANCE }, { color: colors.secondaryText }]}>Choose a song to start your queue.</Text></ScrollView>;

  // iOS sizes a direct ScrollView child of its native sheet content wrapper.
  // Keep all header content inside that list and avoid native View ancestors.
  const header = <View>
    <PlayerDetailsTabs onChange={setTab} value={tab} />
    {tab === 'queue' ? <>
      <View style={styles.sourceBlock}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.overline, { color: colors.secondaryText }]}>Playing from</Text>
          <Text numberOfLines={2} style={[styles.source, { color: colors.text }]}>{source}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Finish editing queue' : 'Edit upcoming queue'}
          disabled={!items.length} onPress={() => setEditing(!editing)} style={styles.textButton}>
          <Text style={{ color: colors.accent, fontWeight: '700', opacity: items.length ? 1 : 0.4 }}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>
      <Text style={[styles.section, { color: colors.secondaryText }]}>NOW PLAYING</Text>
      <SongRow song={currentSong} active onPlay={() => playQueueIndex(queueIndex)} subtitle={currentSong.creator} />
      <Text style={[styles.section, { color: colors.secondaryText }]}>UP NEXT</Text>
      {editing ? <Text style={[styles.editHint, { color: colors.secondaryText }]}>Drag a handle to move a song. Hold near an edge to scroll.</Text> : null}
    </> : null}
  </View>;

  return (
    <>
      {tab === 'queue' ? (
        <ReorderableQueue
          items={items}
          editing={editing}
          onMove={moveQueueItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={header}
          renderRow={(item, handle) => <View style={styles.queueRow}>
            <View style={{ flex: 1 }}><SongRow song={item.song} active={false}
              onPlay={() => playQueueIndex(item.index)} subtitle={item.song.creator} /></View>
            {editing ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.song.title} from queue`}
              onPress={() => removeFromQueue(item.index)} style={styles.rowControl}>
              <SymbolView name="minus.circle" size={22} tintColor={colors.secondaryText} />
            </Pressable> : null}
            {handle}
          </View>}
          ListFooterComponent={<>
            <View style={styles.queueFooter}>
              {!items.length ? <Text style={[styles.emptyQueue, { color: colors.secondaryText }]}>Your queue is clear. Add a song or explore Related.</Text> : null}
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: autoplayEnabled }} onPress={toggleAutoplay} style={styles.footerRow}>
                <SymbolView name="infinity" size={23} tintColor={autoplayEnabled ? colors.accent : colors.secondaryText} />
                <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '700' }}>Autoplay {autoplayEnabled ? 'on' : 'off'}</Text><Text style={{ color: colors.secondaryText, marginTop: 3 }}>Keep listening when your queue ends.</Text></View>
              </Pressable>
              {queueIndex > 0 ? <Pressable accessibilityRole="button" onPress={() => setShowHistory(!showHistory)} style={styles.textButton}><Text style={{ color: colors.accent }}>{showHistory ? 'Hide' : 'Show'} previously played ({queueIndex})</Text></Pressable> : null}
            </View>
            {showHistory && queueIndex > 0 ? <>
              <Text style={[styles.section, { color: colors.secondaryText }]}>PREVIOUSLY PLAYED</Text>
              {queue.slice(0, queueIndex).map((song, index) => <SongRow key={`${song.id}:${index}`} song={song} active={false}
                onPlay={() => playQueueIndex(index)} subtitle={song.creator} />)}
            </> : null}
          </>}
        />
      ) : <FlatList
          key="related"
          data={loading || error ? [] : related}
          keyExtractor={(song) => song.id}
          style={styles.list}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListHeaderComponent={header}
          ListEmptyComponent={loading ? <ActivityIndicator color={colors.accent} style={styles.loader} />
            : error ? <View style={styles.error}><Text style={{ color: colors.secondaryText }}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setRevision(revision + 1)} style={styles.textButton}><Text style={{ color: colors.accent }}>Retry</Text></Pressable></View>
            : <Text style={[styles.empty, { color: colors.secondaryText }]}>No related songs available yet.</Text>}
          renderItem={({ item }) => <View style={styles.relatedRow}>
            <SongListRow
              song={item}
              onPress={() => playSong(item, related, 'Related')}
              onMenuPress={() => router.push(actionSheetHref({
                type: 'song', id: item.id, title: item.title, subtitle: item.creator,
                image: item.imageSmall || item.image, artistId: item.artistId, source: item.source,
              }))}
            />
          </View>}
        />}
    </>
  );
}

const SongRow = memo(function SongRow({ song, active, onPlay, subtitle }: { song: CrimsonSong; active: boolean; onPlay: () => void; subtitle: string }) {
  const { togglePlay } = usePlayer();
  return active ? <ActiveSongRow song={song} onPlay={togglePlay} subtitle={subtitle} /> : <SongRowContent song={song} onPlay={onPlay} subtitle={subtitle} />;
});
function ActiveSongRow({ song, onPlay, subtitle }: { song: CrimsonSong; onPlay: () => void; subtitle: string }) {
  const { playing } = usePlayerStatus();
  return <SongRowContent active playing={playing} song={song} onPlay={onPlay} subtitle={subtitle} />;
}
function SongRowContent({ song, onPlay, subtitle, active = false, playing = false }: { song: CrimsonSong; onPlay: () => void; subtitle: string; active?: boolean; playing?: boolean }) {
  const { colors } = useAppSettings();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${song.title} by ${song.creator}`} accessibilityState={{ selected: active }} onPress={onPlay} style={({ pressed }) => [styles.row, (active || pressed) && { backgroundColor: colors.accentSoft }]}>
    <NowPlayingArtwork borderRadius={10} size={46} song={song} />
    <View style={styles.rowCopy}><Text numberOfLines={1} style={[styles.rowTitle, { color: active ? colors.accent : colors.text }]}>{song.title}</Text><Text numberOfLines={1} style={[styles.rowSubtitle, { color: colors.secondaryText }]}>{subtitle}</Text></View>
    <DownloadStatusIcon trackId={song.id} />
    <SymbolView name={active && playing ? 'pause.fill' : 'play.fill'} size={active ? 18 : 14} tintColor={colors.text} />
  </Pressable>;
}
const styles = StyleSheet.create({
  list: { flex: 1 }, sourceBlock: { paddingHorizontal: Platform.OS === 'web' ? POPUP_MOBILE_INSET : 22, paddingTop: 12, paddingBottom: 13, flexDirection: 'row', alignItems: 'center' },
  overline: { fontSize: 13 }, source: { marginTop: 3, fontSize: 20, fontWeight: '800' },
  section: { fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: Platform.OS === 'web' ? POPUP_MOBILE_INSET : 22, paddingTop: 14, paddingBottom: 8 },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Platform.OS === 'web' ? POPUP_MOBILE_INSET : 18, paddingVertical: 10 },
  rowCopy: { flex: 1, minWidth: 0 }, rowTitle: { fontSize: 15, fontWeight: '700' }, rowSubtitle: { marginTop: 2, fontSize: 13 },
  queueRow: { flex: 1, flexDirection: 'row', alignItems: 'center' }, rowControl: { width: 42, minHeight: 60, alignItems: 'center', justifyContent: 'center' },
  textButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' }, relatedRow: { paddingHorizontal: Platform.OS === 'web' ? POPUP_MOBILE_INSET : 22, paddingVertical: 7 },
  queueFooter: { paddingHorizontal: 20, paddingTop: 16, gap: 8 }, footerRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14 },
  emptyQueue: { fontSize: 14, paddingVertical: 14 }, editHint: { fontSize: 12, lineHeight: 17, paddingHorizontal: Platform.OS === 'web' ? POPUP_MOBILE_INSET : 22, paddingBottom: 10 },
  loader: { marginTop: 70 }, empty: { padding: Platform.OS === 'web' ? POPUP_MOBILE_INSET : 24, fontSize: 15 }, error: { padding: Platform.OS === 'web' ? POPUP_MOBILE_INSET : 24, alignItems: 'center' },
});
