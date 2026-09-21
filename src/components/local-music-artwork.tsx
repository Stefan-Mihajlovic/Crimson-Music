import BuiltInCollectionArtwork, { type BuiltInArtworkProps } from '@/components/built-in-collection-artwork';

const localMusicCover = require('@/assets/images/local-music/cover-matte.png');

/** Sized by its cover container, consistently with the Favorites artwork. */
export default function LocalMusicArtwork({ size: _legacySize, ...props }: BuiltInArtworkProps & { size?: number }) {
  return <BuiltInCollectionArtwork {...props} source={localMusicCover} />;
}
