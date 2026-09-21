import { Image, type ImageProps } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type BuiltInArtworkProps = Omit<ImageProps, 'source' | 'autoplay' | 'style'> & {
  style?: StyleProp<ViewStyle>;
  variant?: 'thumbnail' | 'hero';
};

/** Favorites and Local Music share one static, proportionate cover treatment. */
export default function BuiltInCollectionArtwork({ source, style, variant = 'thumbnail', ...props }: BuiltInArtworkProps & { source: ImageProps['source'] }) {
  return <View style={[styles.artwork, style]}>
    <Image {...props} source={source} autoplay={false} contentFit={variant === 'hero' ? 'contain' : 'cover'}
      style={variant === 'hero' ? StyleSheet.absoluteFill : styles.thumbnail} />
  </View>;
}
const styles = StyleSheet.create({
  artwork: { overflow: 'hidden', backgroundColor: '#121017' },
  // The composition leaves room below for hero text. A proportional crop centers
  // the forms in list/grid thumbnails; wide heroes contain the full artwork.
  thumbnail: { position: 'absolute', top: '-1%', left: '-8%', width: '116%', height: '116%' },
});
