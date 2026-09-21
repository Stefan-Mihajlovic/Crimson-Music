import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import LoadFailure from '@/components/load-failure';
import PersonalMixCover from '@/components/personal-mix-cover';
import PlaylistCollectionScreen from '@/components/playlist-collection-screen';
import type { SongSort } from '@/components/collection-tools';
import { usePersonalMixes } from '@/hooks/use-personal-mixes';
import { useAuth } from '@/providers/auth-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { Alert } from '@/services/alert';
import { personalMixDefinition, setPersonalMixBookmarked, type PersonalMix } from '@/services/personal-mixes';
import type { CrimsonPlaylist } from '@/types/music';

export default function PersonalMixScreen() {
  const { id, play, playRequest } = useLocalSearchParams<{ id: string; play?: string; playRequest?: string }>();
  const definition = personalMixDefinition(id);
  const { mixes, loading, error, refresh } = usePersonalMixes();
  const mix = mixes.find((item) => item.id === id);
  const { colors } = useAppSettings();
  const { user } = useAuth();
  const { playSong } = usePlayer();
  const songs = useMemo(() => mix?.songs || [], [mix]);
  const name = definition?.title || 'Your Mix';
  const source = mix ? `${name} · ${mix.periodKey}` : name;
  const collectionId = mix ? `mix:${mix.id}:${mix.periodKey}` : '';
  const [sort, setSort] = useState<SongSort>('original');
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);
  const [localBookmark, setLocalBookmark] = useState<{ mix: PersonalMix; value: boolean } | null>(null);
  const bookmarked = localBookmark && localBookmark.mix === mix ? localBookmark.value : Boolean(mix?.bookmarked);
  const autoPlayed = useRef('');
  useEffect(() => {
    const request = `${id}:${playRequest || 'default'}`;
    if (play === '1' && songs[0] && autoPlayed.current !== request) {
      autoPlayed.current = request;
      playSong(songs[0], songs, source, collectionId);
    }
  }, [play, playRequest, id, songs, source, collectionId, playSong]);
  const toggleBookmark = async () => {
    if (!user || !mix || savePending.current) return;
    savePending.current = true;
    setSaving(true);
    try {
      const value = await setPersonalMixBookmarked(user.uid, mix.id, !bookmarked);
      setLocalBookmark({ mix, value });
    } catch (cause) { Alert.alert('Could not update library', cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { savePending.current = false; setSaving(false); }
  };
  const playlist: CrimsonPlaylist = {
    id: collectionId, source: 'crimson', title: name, artists: 'Made for you',
    description: definition?.description, image: '', imageSmall: '', likes: '',
    songs: songs.map((song) => song.id), category: 'Your Mixes',
  };
  return <PlaylistCollectionScreen playlist={playlist} songs={songs} sourceName={source} sourceId={collectionId}
    sort={sort} onSortChange={setSort} loading={loading}
    artwork={definition ? ({ style, size, borderRadius }) => <PersonalMixCover id={definition.id} songs={songs} size={size} borderRadius={borderRadius} style={style} showTitle={false} /> : undefined}
    actions={definition ? [{
      label: bookmarked ? 'Remove mix from library' : 'Save mix to library',
      icon: bookmarked ? 'heart.fill' : 'heart', selected: bookmarked, loading: saving,
      disabled: !user || !mix,
      onPress: () => void toggleBookmark(),
    }] : []}
    emptyMessage={!definition ? 'This mix does not exist.' : mix?.status === 'offline' ? 'Connect to create your first edition of this mix.' : definition.emptyMessage}
    emptyContent={error || mix?.status === 'error' ? <LoadFailure title="Could not load this mix" onRetry={refresh} /> : undefined}
    notice={mix?.stale ? <Pressable accessibilityRole="button" accessibilityLabel="Refresh mix" onPress={refresh} style={{ padding: 20 }}><Text style={{ color: colors.accent }}>Showing your last edition. Connect to refresh.</Text></Pressable> : undefined}
  />;
}
