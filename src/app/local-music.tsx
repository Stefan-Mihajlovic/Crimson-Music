import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import PlaylistCollectionScreen from '@/components/playlist-collection-screen';
import LocalMusicArtwork from '@/components/local-music-artwork';
import type { SongSort } from '@/components/collection-tools';
import { actionSheetHref } from '@/services/action-sheet';
import { LOCAL_MUSIC_ID, readLocalMusic, refreshImportedMusic, subscribeLocalMusic } from '@/services/local-music';
import type { CrimsonPlaylist, CrimsonSong } from '@/types/music';

export default function LocalMusicScreen() {
  const router = useRouter();
  const [songs, setSongs] = useState<CrimsonSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SongSort>('title');
  useEffect(() => subscribeLocalMusic(() => { void readLocalMusic().then(setSongs).catch(() => undefined); }), []);
  useFocusEffect(useCallback(() => {
    let active = true;
    void readLocalMusic().then((stored) => { if (active) setSongs(stored); }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
    void refreshImportedMusic().then((next) => { if (active) setSongs(next); }).catch(() => undefined);
    return () => { active = false; };
  }, []));
  const playlist: CrimsonPlaylist = {
    id: LOCAL_MUSIC_ID, source: 'crimson', title: 'Local Music', artists: 'On this device',
    image: '', imageSmall: '', likes: '', songs: songs.map((song) => song.id), category: 'Local Music',
  };
  return <PlaylistCollectionScreen playlist={playlist} songs={songs} sort={sort} onSortChange={setSort} loading={loading}
    artwork={({ style, size }) => <LocalMusicArtwork variant="hero" size={size * 0.31} style={style} />}
    actions={[{ label: 'Local Music options', icon: 'ellipsis', onPress: () => router.push(actionSheetHref({ type: 'local-music', id: LOCAL_MUSIC_ID, title: 'Local Music', subtitle: 'On this device', image: '' })) }]}
    emptyMessage="Use the options menu to import audio or scan your device."
  />;
}
