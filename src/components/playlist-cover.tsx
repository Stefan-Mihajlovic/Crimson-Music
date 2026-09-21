import { SymbolView } from '@/components/app-symbol';
import ArtworkImage from '@/components/artwork-image';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { CollectionPlayingOverlay } from '@/components/now-playing-artwork';
import { CrimsonPlaylist } from '@/types/music';
import { useAppSettings } from '@/providers/settings-provider';

const fallbackArtwork = require('@/assets/images/home/default-song.webp');

export default function PlaylistCover({
  borderRadius = 17,
  playlist,
  preferLarge = false,
  showPlayingIndicator = true,
  style,
}: {
  borderRadius?: number;
  playlist: Pick<CrimsonPlaylist, 'coverImages' | 'coverImagesSmall' | 'image' | 'imageSmall' | 'title' | 'artwork'>;
  preferLarge?: boolean;
  showPlayingIndicator?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { dataSaver, colors } = useAppSettings();
  const customCover = preferLarge && !dataSaver
    ? playlist.image || playlist.imageSmall
    : playlist.imageSmall || playlist.image;
  const tiles = ((dataSaver || !preferLarge) && playlist.coverImagesSmall?.length ? playlist.coverImagesSmall : playlist.coverImages || []).filter(Boolean).slice(0, 4);

  return (
    <View style={[styles.cover, { borderRadius }, style]}>
      {customCover ? (
        <ArtworkImage artwork={playlist.artwork} fallbackSource={fallbackArtwork} cachePolicy="memory-disk" contentFit="cover" source={{ uri: customCover }} style={StyleSheet.absoluteFill} />
      ) : tiles.length >= 4 ? (
        <View style={styles.grid}>
          {tiles.map((uri, index) => <ArtworkImage key={`${uri}:${index}`} fallbackSource={fallbackArtwork} cachePolicy="memory-disk" contentFit="cover" source={{ uri }} style={styles.tile} />)}
        </View>
      ) : tiles.length ? (
        <ArtworkImage fallbackSource={fallbackArtwork} cachePolicy="memory-disk" contentFit="cover" source={{ uri: tiles[0] }} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[styles.logoCenter, { backgroundColor: colors.accentSoft }]}>
          <SymbolView name="music.note.list" size={32} tintColor={colors.accent} />
        </View>
      )}
      {showPlayingIndicator ? <CollectionPlayingOverlay sourceName={playlist.title} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden', backgroundColor: '#1F1D23' },
  grid: { position: 'absolute', inset: 0, flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '50%', height: '50%', backgroundColor: '#211C28' },
  logoCenter: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoShell: {
    width: '27%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.88)',
    backgroundColor: '#17070D',
    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
  },
  logo: { width: '100%', height: '100%' },
});
