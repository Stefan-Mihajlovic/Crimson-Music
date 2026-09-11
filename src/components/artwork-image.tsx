import { Image, type ImageProps } from 'expo-image';
import type { ArtworkSet } from '@/types/music';

export type ArtworkImageProps = ImageProps & {
  artwork?: Partial<ArtworkSet>;
  fallbackSource?: ImageProps['source'];
};

/** Keep native image loading and caching unchanged. */
export default function ArtworkImage({ artwork: _artwork, fallbackSource: _fallbackSource, ...props }: ArtworkImageProps) {
  return <Image {...props} />;
}
