import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import ArtistSpotlight from '@/components/artist-spotlight';
import HomeDiscoverySections from '@/components/home-discovery-sections';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import type { DiscoveryProfile } from '@/services/discovery-profile';
import { loadHomeDiscovery, loadHomeSpotlightTracks } from '@/services/home-discovery';
import type { CrimsonArtist, CrimsonSong } from '@/types/music';

type Props = {
  artist: CrimsonArtist | null;
  profile: DiscoveryProfile;
  rotation: number;
  excludeTrackIds: string[];
  contentWidth: number;
  onOpenArtist: (artist: CrimsonArtist) => void;
  onArtistMenu: (artist: CrimsonArtist) => void;
  onSongMenu: (song: CrimsonSong) => void;
};

export default function HomeDiscovery(props: Props) {
  const { user } = useAuth();
  // A different listener or preference draft never sees the previous listener's shelves.
  const { dataSaver } = useAppSettings();
  const key = JSON.stringify([user?.uid, props.profile, props.rotation, dataSaver]);
  return <AccountHomeDiscovery key={key} {...props} uid={user?.uid} />;
}

function AccountHomeDiscovery({ artist, profile, rotation, excludeTrackIds, contentWidth, onOpenArtist, onArtistMenu, onSongMenu, uid }: Props & { uid?: string }) {
  const { isOffline } = useNetwork();
  const { colors } = useAppSettings();
  const { playSong } = usePlayer();
  const [shelves, setShelves] = useState<Awaited<ReturnType<typeof loadHomeDiscovery>>>({ underground: [] });
  const [spotlight, setSpotlight] = useState<{ artistId: string; songs: CrimsonSong[] } | null>(null);
  const artistId = artist?.id;

  useEffect(() => {
    let active = true;
    void loadHomeDiscovery(uid, profile, rotation, { offlineOnly: isOffline })
      .then((result) => { if (active) setShelves(result); })
      .catch(() => { /* Optional shelves must not interrupt the main feed. */ });
    return () => { active = false; };
    // The keyed parent remounts this component whenever profile or rotation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, isOffline]);

  useEffect(() => {
    if (!artistId) return;
    let active = true;
    void loadHomeSpotlightTracks(artistId, uid, { offlineOnly: isOffline })
      .then((songs) => { if (active) setSpotlight({ artistId, songs }); })
      .catch(() => { if (active) setSpotlight({ artistId, songs: [] }); });
    return () => { active = false; };
  }, [artistId, uid, isOffline]);

  const spotlightSongs = spotlight && spotlight.artistId === artistId ? spotlight.songs : [];
  return <>
    {artist ? <View style={styles.spotlightSection}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Artist spotlight</Text>
      <ArtistSpotlight artist={artist} songs={spotlightSongs} loading={spotlight?.artistId !== artistId}
        onPlay={() => { if (spotlightSongs.length) playSong(spotlightSongs[0], spotlightSongs, artist.name); }}
        onOpen={() => onOpenArtist(artist)} onMenu={() => onArtistMenu(artist)} />
    </View> : null}
    <HomeDiscoverySections underground={shelves.underground} contentWidth={contentWidth}
      excludeTrackIds={[...excludeTrackIds, ...spotlightSongs.map((song) => song.id)]}
      onPlaySong={(song, queue, source) => playSong(song, queue, source)}
      onSongMenu={onSongMenu} />
  </>;
}

const styles = StyleSheet.create({
  spotlightSection: { marginTop: 32, gap: 14 },
  heading: { fontSize: 22, lineHeight: 27, fontWeight: '700', letterSpacing: -0.45 },
});
