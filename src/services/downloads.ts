import { audiusMediaHeaders } from '@/services/audius-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths, type DownloadProgress } from 'expo-file-system';

import { audiusStreamUrl } from '@/services/audius';
import { resolveTrackPlaybackUrl } from '@/services/music';
import type { CrimsonSong } from '@/types/music';
import { isAccountDeleted } from '@/services/account-lifecycle';

export const DOWNLOAD_MIN_BYTES = 100 * 1024 * 1024;
export const DOWNLOAD_MAX_BYTES = 4 * 1024 * 1024 * 1024;
export const DOWNLOAD_DEFAULT_BYTES = 1024 * 1024 * 1024;
export const DOWNLOAD_MAX_TRACK_BYTES = 512 * 1024 * 1024;

export function estimatedTrackDownloadBytes(song: CrimsonSong) {
  return Math.max(5 * 1024 * 1024, Math.ceil(song.duration * 40_000 + 512 * 1024));
}

export type DownloadReason = 'manual' | 'favorite' | 'playlist';

export type DownloadEntry = {
  bytes: number;
  downloadedAt: number;
  lastAccessedAt: number;
  reason: DownloadReason;
  song: CrimsonSong;
  uri: string;
};

export type DownloadPreferences = {
  automatic: boolean;
  enabled: boolean;
  maxBytes: number;
  wifiOnly: boolean;
};

export type DownloadManifest = Record<string, DownloadEntry>;
export type DownloadCollectionTarget = {
  downloadableTrackIds: string[];
  reason: DownloadReason;
  requestedAt: number;
  trackIds: string[];
  unavailableTrackIds: string[];
};
export type DownloadCollectionTargets = Record<string, DownloadCollectionTarget>;

const manifestKey = (uid: string) => `crimson.downloads.manifest.v1:${uid}`;
const preferencesKey = (uid: string) => `crimson.downloads.preferences.v1:${uid}`;
const collectionTargetsKey = (uid: string) => `crimson.downloads.collections.v1:${uid}`;

const defaultPreferences: DownloadPreferences = {
  automatic: false,
  enabled: false,
  maxBytes: DOWNLOAD_DEFAULT_BYTES,
  wifiOnly: false,
};

function safePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function downloadDirectory(uid: string) {
  return new Directory(Paths.document, 'crimson-downloads', safePathPart(uid));
}

function ensureDownloadDirectory(uid: string) {
  const directory = downloadDirectory(uid);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableDownloadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /status\s+(?:408|429|5\d\d)/i.test(message)
    || /UnableToDownloadException/i.test(message)
    || /network request failed|connection|timed? ?out|temporarily unavailable/i.test(message)
  );
}

function friendlyDownloadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/status\s+(?:429|5\d\d)|UnableToDownloadException/i.test(message)) {
    return new Error('Audius is temporarily unavailable for this song. Please try again in a moment.');
  }
  return error instanceof Error
    ? error
    : new Error('The song could not be saved for offline listening.');
}

export async function loadDownloadPreferences(uid: string): Promise<DownloadPreferences> {
  const stored = await AsyncStorage.getItem(preferencesKey(uid));
  if (!stored) return defaultPreferences;
  try {
    const parsed = JSON.parse(stored) as Partial<DownloadPreferences>;
    return {
      automatic: parsed.automatic === true,
      enabled: parsed.enabled === true,
      maxBytes: Math.max(
        DOWNLOAD_MIN_BYTES,
        Math.min(DOWNLOAD_MAX_BYTES, Number(parsed.maxBytes) || DOWNLOAD_DEFAULT_BYTES),
      ),
      wifiOnly: parsed.wifiOnly === true,
    };
  } catch {
    return defaultPreferences;
  }
}

export async function saveDownloadPreferences(uid: string, preferences: DownloadPreferences) {
  if (isAccountDeleted(uid)) return;
  await AsyncStorage.setItem(preferencesKey(uid), JSON.stringify(preferences));
}

export async function loadDownloadCollectionTargets(uid: string): Promise<DownloadCollectionTargets> {
  const stored = await AsyncStorage.getItem(collectionTargetsKey(uid));
  if (!stored) return {};
  try {
    return JSON.parse(stored) as DownloadCollectionTargets;
  } catch {
    return {};
  }
}

export async function saveDownloadCollectionTargets(
  uid: string,
  targets: DownloadCollectionTargets,
) {
  if (isAccountDeleted(uid)) return;
  await AsyncStorage.setItem(collectionTargetsKey(uid), JSON.stringify(targets));
}

export async function loadDownloadManifest(uid: string): Promise<DownloadManifest> {
  const stored = await AsyncStorage.getItem(manifestKey(uid));
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored) as DownloadManifest;
    const verified = Object.fromEntries(Object.entries(parsed).flatMap(([trackId, entry]) => {
      try {
        const file = new File(entry.uri);
        if (!file.exists || file.size <= 0) return [];
        if (file.size > DOWNLOAD_MAX_TRACK_BYTES) {
          file.delete();
          return [];
        }
        return [[trackId, { ...entry, bytes: file.size }]];
      } catch {
        return [];
      }
    }));
    if (Object.keys(verified).length !== Object.keys(parsed).length) {
      await AsyncStorage.setItem(manifestKey(uid), JSON.stringify(verified));
    }
    return verified;
  } catch {
    return {};
  }
}

export async function saveDownloadManifest(uid: string, manifest: DownloadManifest) {
  if (isAccountDeleted(uid)) return;
  await AsyncStorage.setItem(manifestKey(uid), JSON.stringify(manifest));
}

export async function downloadTrackFile(
  uid: string,
  song: CrimsonSong,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
) {
  if (signal?.aborted || isAccountDeleted(uid)) throw new Error('Download cancelled.');
  const directory = ensureDownloadDirectory(uid);
  const target = new File(directory, `${safePathPart(song.id)}.mp3`);
  const playbackUrl = await resolveTrackPlaybackUrl(song);
  if (!playbackUrl) throw new Error('This song does not have an available stream.');
  const candidates = Array.from(new Set([
    playbackUrl,
    ...(song.source === 'audius' ? [audiusStreamUrl(song.id)] : []),
  ]));
  let lastError: unknown = new Error('The song could not be saved for offline listening.');

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await wait(450 * 2 ** (attempt - 1));
    if (signal?.aborted || isAccountDeleted(uid)) throw new Error('Download cancelled.');
    const abortController = new AbortController();
    const abort = () => abortController.abort();
    signal?.addEventListener('abort', abort, { once: true });
    let exceededTrackLimit = false;
    let stalled = false;
    let stallTimer: ReturnType<typeof setTimeout>;
    const resetStallTimer = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => { stalled = true; abortController.abort(); }, 30_000);
    };
    resetStallTimer();
    try {
      const downloadUrl = candidates[attempt % candidates.length];
      const headers = await audiusMediaHeaders(downloadUrl);
      const file = await File.downloadFileAsync(downloadUrl, target, {
        headers,
        idempotent: true,
        onProgress: (progress) => {
          resetStallTimer();
          if (
            progress.bytesWritten > DOWNLOAD_MAX_TRACK_BYTES
            || progress.totalBytes > DOWNLOAD_MAX_TRACK_BYTES
          ) {
            exceededTrackLimit = true;
            abortController.abort();
            return;
          }
          onProgress?.(progress);
        },
        signal: abortController.signal,
      });
      if (!file.exists || file.size <= 0) throw new Error('The downloaded audio file is empty.');
      if (file.size > DOWNLOAD_MAX_TRACK_BYTES) {
        file.delete();
        throw new Error('This song is larger than the 512 MB per-song offline limit.');
      }
      return { bytes: file.size, uri: file.uri };
    } catch (error) {
      deleteDownloadedFile(target.uri);
      if (exceededTrackLimit) {
        throw new Error('This song is larger than the 512 MB per-song offline limit.');
      }
      lastError = stalled ? new Error('The download connection timed out. Please try again.') : error;
      if (signal?.aborted || !isRetryableDownloadError(lastError)) break;
    } finally {
      clearTimeout(stallTimer!);
      signal?.removeEventListener('abort', abort);
    }
  }

  throw friendlyDownloadError(lastError);
}

export function deleteDownloadedFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The manifest can still be repaired even if the operating system already removed the file.
  }
}

export async function clearDownloadedFiles(uid: string, manifest: DownloadManifest) {
  Object.values(manifest).forEach((entry) => deleteDownloadedFile(entry.uri));
  try {
    const directory = downloadDirectory(uid);
    if (directory.exists) directory.delete();
  } catch {
    // Individual files were already removed above.
  }
  await saveDownloadManifest(uid, {});
}
