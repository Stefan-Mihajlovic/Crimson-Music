import type { ArtworkSet } from '@/types/music';

export const FAILED_ARTWORK_TTL = 5 * 60 * 1000;
const MAX_FAILED_URLS = 512;
const MAX_CANDIDATES = 10;
const failedUrls = new Map<string, number>();

function mediaUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}

/** Audius returns mirror node origins, not full image URLs. Use only supplied nodes and content paths. */
export function artworkCandidates(primary: string, artwork?: Partial<ArtworkSet>): string[] {
  const result = new Set<string>();
  const known = [primary, artwork?.small, artwork?.medium, artwork?.large].filter((value): value is string => Boolean(value));
  const mirrors = (artwork?.mirrors || []).slice(0, 3).flatMap((value) => {
    const url = mediaUrl(value);
    return url?.protocol === 'https:' && url.pathname === '/' && !url.search && !url.hash ? [url.origin] : [];
  });
  for (const value of known) {
    const url = mediaUrl(value);
    if (!url) continue;
    result.add(url.href);
    // Mirror the exact content CID and size; never forward query parameters or invent nodes.
    if (url.protocol === 'https:' && /^\/content\/[^/]+\/[^/]+$/.test(url.pathname)) {
      for (const mirror of mirrors) result.add(`${mirror}${url.pathname}`);
    }
    if (result.size >= MAX_CANDIDATES) break;
  }
  return [...result].slice(0, MAX_CANDIDATES);
}

export function isFailedArtwork(url: string, now = Date.now()): boolean {
  const expiry = failedUrls.get(url);
  if (!expiry) return false;
  if (expiry <= now) { failedUrls.delete(url); return false; }
  return true;
}

export function markArtworkFailed(url: string, now = Date.now()) {
  for (const [key, expiry] of failedUrls) if (expiry <= now) failedUrls.delete(key);
  failedUrls.delete(url);
  failedUrls.set(url, now + FAILED_ARTWORK_TTL);
  while (failedUrls.size > MAX_FAILED_URLS) failedUrls.delete(failedUrls.keys().next().value!);
}

export function clearFailedArtworkCache() { failedUrls.clear(); }
