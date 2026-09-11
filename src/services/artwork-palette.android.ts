import { Image } from 'expo-image';
import { requireNativeModule } from 'expo-modules-core';

import type { ArtworkPalette } from './artwork-palette';
export type { ArtworkPalette } from './artwork-palette';
export const fallbackArtworkPalette: ArtworkPalette = ['#34323B', '#252831', '#45404B'];

type AndroidPaletteModule = {
  extractCrimsonArtworkPalette?: (source: string, cacheKey: string, allowNetwork: boolean) => Promise<string[]>;
};
const audio = requireNativeModule<AndroidPaletteModule>('ExpoAudio');
const palettes = new Map<string, ArtworkPalette>();
const pending = new Map<string, Promise<ArtworkPalette | null>>();

export function getCachedArtworkPalette(source: string | undefined): ArtworkPalette | undefined {
  return source ? palettes.get(source) : undefined;
}

export function getArtworkPalette(
  source: string,
  { allowNetwork, alternativeSource }: { allowNetwork: boolean; alternativeSource?: string },
): Promise<ArtworkPalette | null> {
  const cached = palettes.get(source);
  if (cached) return Promise.resolve(cached);
  if (typeof audio.extractCrimsonArtworkPalette !== 'function') return Promise.resolve(null);
  // Cache-only calls never join an in-flight network request from another setting.
  const key = `${allowNetwork ? 'network' : 'cache'}:${source}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const request = (async () => {
    const candidates = [...new Set([source, alternativeSource].filter((uri): uri is string => Boolean(uri)))];
    const cachedFiles = await Promise.all(candidates.map((uri) => Image.getCachePathAsync(uri).catch(() => null)));
    const localFile = cachedFiles.find(Boolean);
    const input = localFile ? (localFile.startsWith('file://') ? localFile : `file://${localFile}`) : (alternativeSource || source);
    // Native code checks its bounded persistent palette cache before decoding a
    // local cover or performing a permitted network request, always off the UI thread.
    const result = await audio.extractCrimsonArtworkPalette!(input, source, allowNetwork);
    if (result.length !== 3 || !result.every((color) => /^#[0-9a-f]{6}$/i.test(color))) return null;
    const palette: ArtworkPalette = [result[0], result[1], result[2]];
    palettes.set(source, palette);
    if (palettes.size > 120) palettes.delete(palettes.keys().next().value!);
    return palette;
  })().catch(() => null).finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
