import { Image } from 'expo-image';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { CollectionPlayingOverlay } from '@/components/now-playing-artwork';
import { CrimsonPlaylist } from '@/types/music';
import { useAppSettings } from '@/providers/settings-provider';

const fallbackArtwork = require('@/assets/images/home/default-song.webp');
const crimsonLogo = require('@/assets/images/icon.png');

export default function PlaylistCover({
  borderRadius = 17,
  playlist,
  preferLarge = false,
  showPlayingIndicator = true,
  style,
}: {
  borderRadius?: number;
  playlist: Pick<CrimsonPlaylist, 'coverImages' | 'coverImagesSmall' | 'image' | 'imageSmall' | 'title'>;
  preferLarge?: boolean;
  showPlayingIndicator?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { dataSaver } = useAppSettings();
  const customCover = preferLarge && !dataSaver
    ? playlist.image || playlist.imageSmall
    : playlist.imageSmall || playlist.image;
  const tiles = ((dataSaver || !preferLarge) && playlist.coverImagesSmall?.length ? playlist.coverImagesSmall : playlist.coverImages || []).filter(Boolean).slice(0, 4);

  return (
    <View style={[styles.cover, { borderRadius }, style]}>
      {customCover ? (
        <Image cachePolicy="memory-disk" contentFit="cover" source={{ uri: customCover }} style={StyleSheet.absoluteFill} />
      ) : (
        <>
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((index) => (
              <Image
                cachePolicy="memory-disk"
                key={index}
                contentFit="cover"
                source={tiles[index] ? { uri: tiles[index] } : fallbackArtwork}
                style={styles.tile}
              />
            ))}
          </View>
          <View style={styles.logoCenter}>
            <View style={styles.logoShell}>
              <Image contentFit="cover" source={crimsonLogo} style={styles.logo} />
            </View>
          </View>
        </>
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
