import type { ArtworkPalette } from './artwork-palette';
export type { ArtworkPalette } from './artwork-palette';
export const fallbackArtworkPalette: ArtworkPalette = [
  '#34323B',
  '#252831',
  '#45404B',
];
const palettes = new Map<string, ArtworkPalette>();
const pending = new Map<string, Promise<ArtworkPalette | null>>();
export const getCachedArtworkPalette = (source?: string) =>
  source ? palettes.get(source) : undefined;
function sample(image: HTMLImageElement): ArtworkPalette | null {
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 40;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, 40, 40);
  const pixels = context.getImageData(0, 0, 40, 40).data;
  const buckets = new Map<string, { rgb: number[]; count: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    if (Math.max(...rgb) < 24 || Math.min(...rgb) > 238) continue;
    const key = rgb.map((v) => v >> 5).join(':');
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.rgb = rgb.map(
        (v, j) => (bucket.rgb[j] * (bucket.count - 1) + v) / bucket.count,
      );
    } else buckets.set(key, { rgb, count: 1 });
  }
  const ranked = [...buckets.values()].sort(
    (a, b) =>
      b.count * (1 + (Math.max(...b.rgb) - Math.min(...b.rgb)) / 255) -
      a.count * (1 + (Math.max(...a.rgb) - Math.min(...a.rgb)) / 255),
  );
  if (!ranked.length) return null;
  const chosen: number[][] = [];
  for (const { rgb } of ranked)
    if (
      chosen.length < 3 &&
      chosen.every(
        (other) =>
          rgb.reduce((sum, v, j) => sum + (v - other[j]) ** 2, 0) > 2500,
      )
    )
      chosen.push(rgb);
  while (chosen.length < 3)
    chosen.push(ranked[Math.min(chosen.length, ranked.length - 1)].rgb);
  const hex = (rgb: number[]) => {
    const brightness = Math.max(...rgb);
    const scale = brightness > 180 ? 180 / brightness : 1;
    return (
      '#' +
      rgb
        .map((v) =>
          Math.round(v * scale)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  };
  return [hex(chosen[0]), hex(chosen[1]), hex(chosen[2])];
}
export function getArtworkPalette(
  source: string,
  {
    allowNetwork,
    alternativeSource,
  }: { allowNetwork: boolean; alternativeSource?: string },
): Promise<ArtworkPalette | null> {
  if (palettes.has(source)) return Promise.resolve(palettes.get(source)!);
  if (typeof document === 'undefined') return Promise.resolve(null);
  const existing = Array.from(document.images).find(
    (image) =>
      image.complete &&
      image.naturalWidth > 0 &&
      (image.src === source || image.src === alternativeSource),
  );
  if (!allowNetwork && !existing) return Promise.resolve(null);
  const key = `${source}:${allowNetwork}`;
  if (pending.has(key)) return pending.get(key)!;
  const remember = (result: ArtworkPalette | null) => {
    if (result) {
      palettes.set(source, result);
      if (palettes.size > 120) palettes.delete(palettes.keys().next().value!);
    }
    return result;
  };
  const request = (async () => {
    if (existing) {
      try {
        return remember(sample(existing));
      } catch {
        // Displaying cross-origin art does not grant canvas pixel access. When
        // allowed, request the same small image with explicit CORS credentials.
        if (!allowNetwork) return null;
      }
    }
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const item = new window.Image();
      item.crossOrigin = 'anonymous';
      const timeout = setTimeout(() => {
        item.src = '';
        reject(new Error('Artwork timed out'));
      }, 8000);
      item.onload = () => {
        clearTimeout(timeout);
        resolve(item);
      };
      item.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Artwork unavailable'));
      };
      item.src = alternativeSource || source;
    });
    return remember(sample(image));
  })()
    .catch(() => null)
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
