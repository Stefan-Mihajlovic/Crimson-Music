import type { ArtworkSet } from '@/types/music';

export const FAILED_ARTWORK_TTL = 5 * 60 * 1000;
const MAX_FAILED_URLS = 512;
const MAX_CANDIDATES = 10;
const failedUrls = new Map<string, number>();
const loadedVersions = new Map<string, number>();
const displayedSelections = new Map<string, { uri: string | null; revision: number }>();
const artworkListeners = new Set<(uri: string) => void>();
let loadedVersion = 0;

export function subscribeArtworkChanges(listener: (uri: string) => void) {
  artworkListeners.add(listener);
  return () => { artworkListeners.delete(listener); };
}
function notifyArtworkChanged(uri: string) { artworkListeners.forEach((listener) => listener(uri)); }
/** The mounted Image owns this selection, even after a failed URL's retry TTL. */
export function reportArtworkSelection(primary: string | undefined, uri: string | null) {
  if (!primary || displayedSelections.get(primary)?.uri === uri) return;
  const previous = displayedSelections.get(primary);
  const changesSelection = (previous ? previous.uri : isFailedArtwork(primary) ? null : primary) !== uri;
  displayedSelections.delete(primary);
  displayedSelections.set(primary, { uri, revision: changesSelection ? ++loadedVersion : 0 });
  while (displayedSelections.size > MAX_FAILED_URLS) displayedSelections.delete(displayedSelections.keys().next().value!);
  if (changesSelection) notifyArtworkChanged(primary);
}
export function observedArtworkUri(candidates: readonly string[]): string | null {
  const rendered = candidates[0] ? displayedSelections.get(candidates[0]) : undefined;
  return rendered ? rendered.uri : displayedArtworkUri(candidates);
}
export function markArtworkLoaded(uri: string) {
  failedUrls.delete(uri);
  loadedVersions.delete(uri);
  loadedVersions.set(uri, ++loadedVersion);
  while (loadedVersions.size > MAX_FAILED_URLS) loadedVersions.delete(loadedVersions.keys().next().value!);
  notifyArtworkChanged(uri);
}
/** A primitive snapshot lets a player observe only its own artwork requests. */
export function artworkStatusSnapshot(candidates: readonly string[]) {
  return candidates.map((uri) => `${isFailedArtwork(uri) ? 1 : 0}:${loadedVersions.get(uri) || 0}:${displayedSelections.get(uri)?.revision || 0}`).join('|');
}

/** Match the Image component, including on-device artwork and Audius mirrors. */
export function imageArtworkCandidates(primary: string, artwork?: Partial<ArtworkSet>): string[] {
  if (primary && !/^https?:/i.test(primary)) return [primary];
  return artworkCandidates(primary, artwork);
}
export function displayedArtworkUri(candidates: readonly string[]): string | null {
  return candidates.find((uri) => !isFailedArtwork(uri)) || null;
}

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
  notifyArtworkChanged(url);
}

export function clearFailedArtworkCache() { failedUrls.clear(); loadedVersions.clear(); displayedSelections.clear(); }
