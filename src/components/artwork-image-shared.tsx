import { Image, type ImageProps } from 'expo-image';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { displayedArtworkUri, imageArtworkCandidates, isFailedArtwork, markArtworkFailed, markArtworkLoaded, reportArtworkSelection } from '@/services/artwork-fallback';
import type { ArtworkSet } from '@/types/music';

export type ArtworkImageProps = ImageProps & {
  artwork?: Partial<ArtworkSet>;
  fallbackSource?: ImageProps['source'];
};
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

/** Native and web use the same fallback selection, including local file covers. */
export default function ArtworkImage({ artwork, source, fallbackSource = defaultArtwork, ...props }: ArtworkImageProps) {
  if (typeof source === 'number') return <Image {...props} source={source} />;
  const candidates = imageArtworkCandidates(imageUri(source), artwork);
  // A changed item/URL owns independent retry state. Old image events cannot
  // overwrite its selection, and a broken fallback never starts a retry loop.
  return <ResolvedArtwork key={`${props.recyclingKey || ''}:${candidates.join('|')}`} {...props}
    candidates={candidates} fallbackSource={publicSource(fallbackSource)} />;
}

function ResolvedArtwork({ candidates, fallbackSource, onError, onLoad, ...props }: Omit<ArtworkImageProps, 'source' | 'artwork'> & { candidates: string[] }) {
  const attempted = useRef(new Set<string>());
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const [uri, setUri] = useState(() => displayedArtworkUri(candidates));
  const currentUri = useRef(uri);
  const primary = candidates[0];
  useLayoutEffect(() => { currentUri.current = uri; reportArtworkSelection(primary, uri); }, [primary, uri]);
  return <Image {...props} key={uri || 'placeholder'} source={uri ? { uri } : fallbackSource}
    onLoad={(event) => {
      if (!live.current || currentUri.current !== uri) return;
      if (uri) markArtworkLoaded(uri);
      onLoad?.(event);
    }}
    onError={(event) => {
      if (!live.current || currentUri.current !== uri) return;
      if (uri) {
        attempted.current.add(uri);
        markArtworkFailed(uri);
        setUri((current) => current === uri ? candidates.find((candidate) => !attempted.current.has(candidate) && !isFailedArtwork(candidate)) || null : current);
      }
      onError?.(event);
    }} />;
}
