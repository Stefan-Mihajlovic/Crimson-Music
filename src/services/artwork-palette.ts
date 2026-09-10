import { Image } from 'expo-image';
import { NativeModules, Platform } from 'react-native';

export type ArtworkPalette = readonly [string, string, string];

// Used only while the first cover is loading or if its pixels are unavailable.
export const fallbackArtworkPalette: ArtworkPalette = ['#34323B', '#252831', '#45404B'];

type ArtworkPaletteModule = {
  extractArtworkPalette?: (source: string, cacheKey: string, allowNetwork: boolean) => Promise<string[]>;
};

const palettes = new Map<string, ArtworkPalette>();
const pending = new Map<string, Promise<ArtworkPalette | null>>();
const nativePalette = NativeModules.CrimsonRemoteControls as ArtworkPaletteModule | undefined;

export function getCachedArtworkPalette(source: string | undefined): ArtworkPalette | undefined {
  return source ? palettes.get(source) : undefined;
}

export function getArtworkPalette(
  source: string,
  { allowNetwork, alternativeSource }: { allowNetwork: boolean; alternativeSource?: string },
): Promise<ArtworkPalette | null> {
  const cached = palettes.get(source);
  if (cached) return Promise.resolve(cached);
  const extract = nativePalette?.extractArtworkPalette;
  if (Platform.OS !== 'ios' || !extract) return Promise.resolve(null);

  // A cache-only request must never start a download or depend on one queued by
  // a previous, less restrictive setting.
  const requestKey = `${allowNetwork ? 'network' : 'cache'}:${source}`;
  const existing = pending.get(requestKey);
  if (existing) return existing;
  const request = (async () => {
    const candidates = [...new Set([source, alternativeSource].filter((uri): uri is string => Boolean(uri)))];
    const cachedFiles = await Promise.all(candidates.map((uri) => Image.getCachePathAsync(uri).catch(() => null)));
    const localFile = cachedFiles.find(Boolean);
    const input = localFile ? (localFile.startsWith('file://') ? localFile : `file://${localFile}`) : source;
    // The native method checks its persistent palette cache before opening the
    // source, so Data Saver also works when iOS has evicted the cover bitmap.
    const result = await extract(input, source, allowNetwork);
    if (result.length !== 3 || !result.every((color) => /^#[0-9a-f]{6}$/i.test(color))) return null;
    const palette: ArtworkPalette = [result[0], result[1], result[2]];
    palettes.set(source, palette);
    if (palettes.size > 120) palettes.delete(palettes.keys().next().value!);
    return palette;
  })().catch(() => null).finally(() => pending.delete(requestKey));
  pending.set(requestKey, request);
  return request;
}
