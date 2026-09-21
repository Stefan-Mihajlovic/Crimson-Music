import BuiltInCollectionArtwork, { type BuiltInArtworkProps } from '@/components/built-in-collection-artwork';

const favoritesCover = require('@/assets/images/favorites/heart-matte.png');

/** Static matte artwork also respects Reduce Motion and Performance Mode. */
export default function FavoritesArtwork(props: BuiltInArtworkProps) {
  return <BuiltInCollectionArtwork {...props} source={favoritesCover} />;
}
