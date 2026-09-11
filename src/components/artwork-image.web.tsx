import { Image, type ImageProps } from 'expo-image';
import { useRef, useState } from 'react';
import type { ArtworkImageProps } from '@/components/artwork-image';
import { artworkCandidates, isFailedArtwork, markArtworkFailed } from '@/services/artwork-fallback';

const defaultArtwork = require('@/assets/images/home/default-song.webp');

function imageUri(source: ImageProps['source']): string {
  if (typeof source === 'string') return source;
  if (Array.isArray(source)) return imageUri(source[0]);
  return source && typeof source === 'object' && 'uri' in source ? source.uri || '' : '';
}

/** Artwork requests must never inherit API authorization or other custom headers. */
function publicSource(source: ImageProps['source']): ImageProps['source'] {
  if (Array.isArray(source)) return source.map((item) => publicSource(item)) as ImageProps['source'];
  if (source && typeof source === 'object' && 'headers' in source) {
    const { headers: _headers, ...rest } = source;
    return rest;
  }
  return source;
}

export default function ArtworkImage({ artwork, source, fallbackSource = defaultArtwork, ...props }: ArtworkImageProps) {
  const primary = imageUri(source);
  const remote = /^https?:/i.test(primary);
  if (!remote && (primary || typeof source === 'number')) return <Image {...props} source={publicSource(source)} />;
  const candidates = artworkCandidates(primary, artwork);
  // A new item/URL gets independent retry state; delayed failures from the old image cannot change it.
  return <RemoteArtwork key={`${props.recyclingKey || ''}:${candidates.join('|')}`} {...props}
    candidates={candidates} fallbackSource={publicSource(fallbackSource)} />;
}

function RemoteArtwork({ candidates, fallbackSource, onError, ...props }: Omit<ArtworkImageProps, 'source' | 'artwork'> & { candidates: string[] }) {
  const attempted = useRef(new Set<string>());
  const [uri, setUri] = useState(() => candidates.find((candidate) => !isFailedArtwork(candidate)) || null);
  return <Image {...props} key={uri || 'placeholder'} source={uri ? { uri } : fallbackSource}
    onError={(event) => {
      if (uri) {
        attempted.current.add(uri);
        markArtworkFailed(uri);
        setUri((current) => current === uri ? candidates.find((candidate) => !attempted.current.has(candidate) && !isFailedArtwork(candidate)) || null : current);
      }
      onError?.(event);
    }} />;
}
