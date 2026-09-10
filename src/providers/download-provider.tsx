/* eslint-disable react-hooks/set-state-in-effect */

import NetInfo, { NetInfoStateType } from '@react-native-community/netinfo';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import { getAudiusTrack } from '@/services/audius';
import {
  clearDownloadedFiles,
  deleteDownloadedFile,
  DOWNLOAD_DEFAULT_BYTES,
  DOWNLOAD_MAX_BYTES,
  DOWNLOAD_MAX_TRACK_BYTES,
  DOWNLOAD_MIN_BYTES,
  DownloadCollectionTarget,
  DownloadCollectionTargets,
  DownloadEntry,
  DownloadManifest,
  DownloadPreferences,
  DownloadReason,
  downloadTrackFile,
  estimatedTrackDownloadBytes,
  loadDownloadCollectionTargets,
  loadDownloadManifest,
  loadDownloadPreferences,
  saveDownloadCollectionTargets,
  saveDownloadManifest,
  saveDownloadPreferences,
} from '@/services/downloads';
import { loadAutomaticDownloadTargets } from '@/services/music';
import { subscribeToLibraryRefresh } from '@/services/navigation-events';
import type { CrimsonSong } from '@/types/music';
import { isAccountDeleted, registerAccountCleanup } from '@/services/account-lifecycle';
import { reportError } from '@/services/telemetry';
import { downloadsRequireWifi, getDataSaverEnabled, subscribeToDataSaver } from '@/services/data-usage';

export type TrackDownloadStatus =
  | { state: 'not-downloaded'; progress: 0 }
  | { state: 'downloading'; progress: number }
  | { state: 'downloaded'; progress: 1 }
  | { state: 'error'; progress: 0; message: string };

export class DownloadError extends Error {
  constructor(
    public code:
      | 'disabled'
      | 'stream-unavailable'
      | 'storage-limit'
      | 'track-too-large'
      | 'unsupported'
      | 'wifi-required'
      | 'failed',
    message: string,
  ) {
    super(message);
    this.name = 'DownloadError';
  }
}

type DownloadBatchResult = {
  downloaded: number;
  failed: number;
  skipped: number;
};

type DownloadContextValue = DownloadPreferences & {
  clearAllDownloads: () => Promise<void>;
  downloadSong: (song: CrimsonSong, reason?: DownloadReason) => Promise<boolean>;
  downloadSongs: (
    songs: CrimsonSong[],
    reason?: DownloadReason,
    collectionKey?: string,
  ) => Promise<DownloadBatchResult>;
  downloadedCount: number;
  downloadedSongs: CrimsonSong[];
  getPlaybackUri: (trackId: string) => string | null;
  hasCollectionOfflineSongs: (collectionKey: string) => boolean;
  isCollectionDownloaded: (collectionKey: string) => boolean;
  isCollectionRequested: (collectionKey: string) => boolean;
  isDownloaded: (trackId: string) => boolean;
  isTrackKnownUnavailable: (trackId: string) => boolean;
  isTrackUnavailableForCollection: (collectionKey: string, trackId: string) => boolean;
  ready: boolean;
  removeDownload: (trackId: string) => Promise<void>;
  setAutomatic: (value: boolean) => void;
  setEnabled: (value: boolean) => void;
  setMaxBytes: (value: number) => void;
  setWifiOnly: (value: boolean) => void;
  songsForCollection: (collectionKey: string) => CrimsonSong[];
  statusFor: (trackId: string) => TrackDownloadStatus;
  supported: boolean;
  syncAutomaticDownloads: () => Promise<void>;
  usedBytes: number;
};

const emptyPreferences: DownloadPreferences = {
  automatic: false,
  enabled: false,
  maxBytes: DOWNLOAD_DEFAULT_BYTES,
  wifiOnly: false,
};
const priority: Record<DownloadReason, number> = {
  playlist: 1,
  favorite: 2,
  manual: 3,
};
const DownloadContext = createContext<DownloadContextValue | null>(null);

function manifestBytes(manifest: DownloadManifest) {
  return Object.values(manifest).reduce((total, entry) => total + entry.bytes, 0);
}

function friendlyOfflineErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /status\s+(?:429|5\d\d)/i.test(message)
    || /request failed \((?:429|5\d\d)\)/i.test(message)
    || /UnableToDownloadException/i.test(message)
  ) {
    return 'Audius is temporarily unavailable for this song. Please try again in a moment.';
  }
  return message || 'The song could not be saved for offline listening.';
}

function entryWithHigherPriority(entry: DownloadEntry, reason: DownloadReason, song: CrimsonSong): DownloadEntry {
  return {
    ...entry,
    reason: priority[reason] > priority[entry.reason] ? reason : entry.reason,
    song,
  };
}

function collectionTargetFor(
  songs: CrimsonSong[],
  reason: DownloadReason,
  existing?: DownloadCollectionTarget,
): DownloadCollectionTarget {
  const uniqueSongs = Array.from(new Map(songs.map((song) => [song.id, song])).values());
  const trackIds = uniqueSongs.map((song) => song.id);
  const unavailableTrackIds = (existing?.unavailableTrackIds || [])
    .filter((trackId) => trackIds.includes(trackId));
  const unavailableIds = new Set(unavailableTrackIds);
  return {
    downloadableTrackIds: trackIds.filter((trackId) => !unavailableIds.has(trackId)),
    reason: existing && priority[existing.reason] > priority[reason] ? existing.reason : reason,
    requestedAt: Date.now(),
    trackIds,
    unavailableTrackIds,
  };
}

export function DownloadProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const uid = user?.uid || '';
  const supported = Platform.OS !== 'web';
  const [ready, setReady] = useState(false);
  const [loadedUid, setLoadedUid] = useState('');
  const [preferences, setPreferences] = useState(emptyPreferences);
  const [manifest, setManifest] = useState<DownloadManifest>({});
  const [collectionTargets, setCollectionTargets] = useState<DownloadCollectionTargets>({});
  const [activeStatuses, setActiveStatuses] = useState<Record<string, TrackDownloadStatus>>({});
  const manifestRef = useRef(manifest);
  const collectionTargetsRef = useRef(collectionTargets);
  const preferencesRef = useRef(preferences);
  const operationQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const automaticSyncRef = useRef<Promise<void> | null>(null);
  const automaticGenerationRef = useRef(0);
  const sessionRef = useRef({ uid, controller: new AbortController() });

  useEffect(() => registerAccountCleanup(async (deletedUid) => {
    if (deletedUid !== uid) return;
    sessionRef.current.controller.abort();
    automaticGenerationRef.current += 1;
    await operationQueueRef.current.catch(() => undefined);
  }), [uid]);

  const commitManifest = useCallback(async (next: DownloadManifest) => {
    if (sessionRef.current.uid !== uid || sessionRef.current.controller.signal.aborted || isAccountDeleted(uid)) return;
    manifestRef.current = next;
    setManifest(next);
    if (uid) await saveDownloadManifest(uid, next);
  }, [uid]);

  const commitCollectionTargets = useCallback(async (next: DownloadCollectionTargets) => {
    if (sessionRef.current.uid !== uid || sessionRef.current.controller.signal.aborted || isAccountDeleted(uid)) return;
    collectionTargetsRef.current = next;
    setCollectionTargets(next);
    if (uid) await saveDownloadCollectionTargets(uid, next);
  }, [uid]);

  const updatePreferences = useCallback((patch: Partial<DownloadPreferences>) => {
    if (sessionRef.current.uid !== uid || sessionRef.current.controller.signal.aborted) return;
    const next = { ...preferencesRef.current, ...patch };
    preferencesRef.current = next;
    setPreferences(next);
    if (uid) void saveDownloadPreferences(uid, next);
  }, [uid]);

  useEffect(() => {
    let active = true;
    sessionRef.current.controller.abort();
    const session = { uid, controller: new AbortController() };
    sessionRef.current = session;
    automaticGenerationRef.current += 1;
    setReady(false);
    setManifest({});
    manifestRef.current = {};
    setCollectionTargets({});
    collectionTargetsRef.current = {};
    setPreferences(emptyPreferences);
    preferencesRef.current = emptyPreferences;
    setActiveStatuses({});
    if (!uid || !supported) {
      setLoadedUid(uid);
      setReady(true);
      return () => { active = false; session.controller.abort(); };
    }
    Promise.all([
      loadDownloadPreferences(uid),
      loadDownloadManifest(uid),
      loadDownloadCollectionTargets(uid),
    ])
      .then(([nextPreferences, nextManifest, nextCollectionTargets]) => {
        if (!active) return;
        preferencesRef.current = nextPreferences;
        manifestRef.current = nextManifest;
        collectionTargetsRef.current = nextCollectionTargets;
        setPreferences(nextPreferences);
        setManifest(nextManifest);
        setCollectionTargets(nextCollectionTargets);
      })
      .catch((error) => reportError(error, 'downloads.restore'))
      .finally(() => {
        if (active) {
          setLoadedUid(uid);
          setReady(true);
        }
      });
    return () => { active = false; session.controller.abort(); };
  }, [supported, uid]);
  const offlineDataReady = ready && loadedUid === uid;

  const removeDownload = useCallback(async (trackId: string) => {
    if (sessionRef.current.uid !== uid || sessionRef.current.controller.signal.aborted) return;
    const entry = manifestRef.current[trackId];
    if (!entry) return;
    deleteDownloadedFile(entry.uri);
    const next = { ...manifestRef.current };
    delete next[trackId];
    await commitManifest(next);
  }, [commitManifest, uid]);

  const setCollectionTrackEligibility = useCallback(async (
    collectionKey: string | undefined,
    trackId: string,
    eligible: boolean,
  ) => {
    if (!collectionKey) return;
    const target = collectionTargetsRef.current[collectionKey];
    if (!target || !target.trackIds.includes(trackId)) return;
    const downloadableIds = new Set(target.downloadableTrackIds);
    const unavailableIds = new Set(target.unavailableTrackIds || []);
    if (eligible) {
      downloadableIds.add(trackId);
      unavailableIds.delete(trackId);
    } else {
      downloadableIds.delete(trackId);
      unavailableIds.add(trackId);
    }
    await commitCollectionTargets({
      ...collectionTargetsRef.current,
      [collectionKey]: {
        ...target,
        downloadableTrackIds: [...downloadableIds],
        unavailableTrackIds: [...unavailableIds],
      },
    });
  }, [commitCollectionTargets]);

  const performDownload = useCallback(async (
    suppliedSong: CrimsonSong,
    reason: DownloadReason,
    collectionKey?: string,
  ) => {
    if (!supported) throw new DownloadError('unsupported', 'Offline listening is available in the mobile app.');
    const session = sessionRef.current;
    if (session.uid !== uid || session.controller.signal.aborted || isAccountDeleted(uid)) throw new Error('Download cancelled.');
    if (!uid || !preferencesRef.current.enabled) {
      throw new DownloadError('disabled', 'Enable Offline Listening in Settings first.');
    }
    const existing = manifestRef.current[suppliedSong.id];
    if (existing) {
      await setCollectionTrackEligibility(collectionKey, suppliedSong.id, true);
      const next = {
        ...manifestRef.current,
        [suppliedSong.id]: entryWithHigherPriority(existing, reason, suppliedSong),
      };
      await commitManifest(next);
      return false;
    }

    if (downloadsRequireWifi(preferencesRef.current.wifiOnly)) {
      const network = await NetInfo.fetch();
      if (network.type !== NetInfoStateType.wifi || network.isConnected !== true) {
        throw new DownloadError(
          'wifi-required',
          getDataSaverEnabled()
            ? 'Data Saver saves offline music only over Wi-Fi. Connect to Wi-Fi or turn off Data Saver in Account.'
            : 'Connect to Wi-Fi or turn off Save over Wi-Fi only in Account.',
        );
      }
    }

    let song: CrimsonSong;
    try {
      song = suppliedSong.source === 'audius'
        ? await getAudiusTrack(suppliedSong.id)
        : suppliedSong;
    } catch (error) {
      throw new DownloadError('failed', friendlyOfflineErrorMessage(error));
    }
    if (session.controller.signal.aborted || sessionRef.current !== session) throw new Error('Download cancelled.');
    if (!song.streamable) {
      await setCollectionTrackEligibility(collectionKey, song.id, false);
      throw new DownloadError('stream-unavailable', 'This song is not available to stream with the current access.');
    }

    const estimate = estimatedTrackDownloadBytes(song);
    if (estimate > DOWNLOAD_MAX_TRACK_BYTES) {
      await setCollectionTrackEligibility(collectionKey, song.id, false);
      throw new DownloadError(
        'track-too-large',
        'This song is estimated to be larger than the 512 MB per-song offline limit.',
      );
    }
    await setCollectionTrackEligibility(collectionKey, song.id, true);
    const prepared = manifestRef.current;
    if (manifestBytes(prepared) + estimate > preferencesRef.current.maxBytes) {
      if (prepared !== manifestRef.current) await commitManifest(prepared);
      throw new DownloadError('storage-limit', 'The offline listening storage limit has been reached.');
    }
    if (Object.keys(prepared).length !== Object.keys(manifestRef.current).length) {
      await commitManifest(prepared);
    }

    let downloadNetwork = await NetInfo.fetch();
    if (session.controller.signal.aborted || sessionRef.current !== session) throw new Error('Download cancelled.');
    const downloadController = new AbortController();
    const cancelDownload = () => downloadController.abort();
    session.controller.signal.addEventListener('abort', cancelDownload, { once: true });
    let pausedForWifi = false;
    const enforceNetworkPolicy = () => {
      if (downloadsRequireWifi(preferencesRef.current.wifiOnly)
        && (downloadNetwork.type !== NetInfoStateType.wifi || downloadNetwork.isConnected !== true)) {
        pausedForWifi = true;
        downloadController.abort();
      }
    };
    enforceNetworkPolicy();
    const removeNetworkListener = NetInfo.addEventListener((network) => {
      downloadNetwork = network;
      enforceNetworkPolicy();
    });
    const removeDataSaverListener = subscribeToDataSaver(enforceNetworkPolicy);
    setActiveStatuses((current) => ({
      ...current,
      [song.id]: { state: 'downloading', progress: 0 },
    }));
    let lastProgress = -1;
    try {
      if (session.controller.signal.aborted || downloadController.signal.aborted) throw new Error('Download cancelled.');
      const downloaded = await downloadTrackFile(uid, song, ({ bytesWritten, totalBytes }) => {
        if (session.controller.signal.aborted || sessionRef.current !== session) return;
        const rawProgress = totalBytes > 0 ? bytesWritten / totalBytes : 0;
        const progress = Math.max(0, Math.min(0.99, Math.floor(rawProgress * 20) / 20));
        if (progress === lastProgress) return;
        lastProgress = progress;
        setActiveStatuses((current) => ({
          ...current,
          [song.id]: { state: 'downloading', progress },
        }));
      }, downloadController.signal);
      if (downloadController.signal.aborted || session.controller.signal.aborted || sessionRef.current !== session || isAccountDeleted(uid)) {
        deleteDownloadedFile(downloaded.uri);
        throw new Error('Download cancelled.');
      }
      const finalPrepared = manifestRef.current;
      if (manifestBytes(finalPrepared) + downloaded.bytes > preferencesRef.current.maxBytes) {
        deleteDownloadedFile(downloaded.uri);
        await commitManifest(finalPrepared);
        throw new DownloadError('storage-limit', 'This song is too large for the available offline storage.');
      }
      const now = Date.now();
      await commitManifest({
        ...finalPrepared,
        [song.id]: {
          bytes: downloaded.bytes,
          downloadedAt: now,
          lastAccessedAt: now,
          reason,
          song,
          uri: downloaded.uri,
        },
      });
      setActiveStatuses((current) => {
        const next = { ...current };
        delete next[song.id];
        return next;
      });
      return true;
    } catch (error) {
      if (session.controller.signal.aborted || sessionRef.current !== session) throw error;
      if (pausedForWifi) error = new DownloadError('wifi-required', 'Download paused to save mobile data. Connect to Wi-Fi to try again.');
      const message = friendlyOfflineErrorMessage(error);
      const exceededTrackLimit = message.includes('per-song offline limit');
      if (exceededTrackLimit) {
        await setCollectionTrackEligibility(collectionKey, song.id, false);
      }
      setActiveStatuses((current) => ({
        ...current,
        [song.id]: { state: 'error', progress: 0, message },
      }));
      setTimeout(() => {
        if (session.controller.signal.aborted || sessionRef.current !== session) return;
        setActiveStatuses((current) => {
          if (current[song.id]?.state !== 'error') return current;
          const next = { ...current };
          delete next[song.id];
          return next;
        });
      }, 4_000);
      if (error instanceof DownloadError) throw error;
      throw new DownloadError(exceededTrackLimit ? 'track-too-large' : 'failed', message);
    } finally {
      session.controller.signal.removeEventListener('abort', cancelDownload);
      removeNetworkListener();
      removeDataSaverListener();
    }
  }, [commitManifest, setCollectionTrackEligibility, supported, uid]);

  const enqueueOperation = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const session = sessionRef.current;
    const queued = operationQueueRef.current
      .catch(() => undefined)
      .then(() => {
        if (session.controller.signal.aborted || sessionRef.current !== session) throw new Error('Download cancelled.');
        return operation();
      });
    operationQueueRef.current = queued;
    return queued;
  }, []);

  const downloadSong = useCallback((song: CrimsonSong, reason: DownloadReason = 'manual') => {
    return enqueueOperation(() => performDownload(song, reason));
  }, [enqueueOperation, performDownload]);

  const registerCollectionTarget = useCallback(async (
    collectionKey: string,
    songs: CrimsonSong[],
    reason: DownloadReason,
  ) => {
    const next = {
      ...collectionTargetsRef.current,
      [collectionKey]: collectionTargetFor(
        songs,
        reason,
        collectionTargetsRef.current[collectionKey],
      ),
    };
    await commitCollectionTargets(next);
  }, [commitCollectionTargets]);

  const downloadSongs = useCallback(async (
    songs: CrimsonSong[],
    reason: DownloadReason = 'manual',
    collectionKey?: string,
  ): Promise<DownloadBatchResult> => {
    if (collectionKey) await registerCollectionTarget(collectionKey, songs, reason);
    return enqueueOperation(async () => {
      const uniqueSongs = Array.from(new Map(songs.map((song) => [song.id, song])).values());
      const result: DownloadBatchResult = { downloaded: 0, failed: 0, skipped: 0 };
      for (const song of uniqueSongs) {
        try {
          if (await performDownload(song, reason, collectionKey)) result.downloaded += 1;
          else result.skipped += 1;
        } catch {
          result.failed += 1;
        }
      }
      return result;
    });
  }, [enqueueOperation, performDownload, registerCollectionTarget]);

  const syncAutomaticDownloads = useCallback(async () => {
    if (
      automaticSyncRef.current
      || !offlineDataReady
      || !supported
      || !uid
      || !preferencesRef.current.enabled
      || !preferencesRef.current.automatic
    ) return automaticSyncRef.current || Promise.resolve();
    const sync = enqueueOperation(async () => {
      const networkBeforeSync = await NetInfo.fetch();
      if (
        networkBeforeSync.isConnected !== true
        || networkBeforeSync.isInternetReachable === false
        || (downloadsRequireWifi(preferencesRef.current.wifiOnly) && networkBeforeSync.type !== NetInfoStateType.wifi)
      ) return;
      const generation = automaticGenerationRef.current;
      const targets = await loadAutomaticDownloadTargets(uid);
      if (generation !== automaticGenerationRef.current) return;
      const networkAfterLoad = await NetInfo.fetch();
      if (
        networkAfterLoad.isConnected !== true
        || networkAfterLoad.isInternetReachable === false
        || (downloadsRequireWifi(preferencesRef.current.wifiOnly) && networkAfterLoad.type !== NetInfoStateType.wifi)
      ) return;
      const favoriteIds = new Set(targets.favorites.map((song) => song.id));
      const automaticPlaylistKeys = new Set(
        targets.playlists.map((playlist) => `playlist:${playlist.id}`),
      );
      const nextCollectionTargets = { ...collectionTargetsRef.current };
      Object.entries(nextCollectionTargets).forEach(([collectionKey, target]) => {
        if (
          target.reason === 'playlist'
          && !automaticPlaylistKeys.has(collectionKey)
        ) delete nextCollectionTargets[collectionKey];
      });
      nextCollectionTargets.favorites = collectionTargetFor(
        targets.favorites,
        'favorite',
        nextCollectionTargets.favorites,
      );
      targets.playlists.forEach((playlist) => {
        const collectionKey = `playlist:${playlist.id}`;
        nextCollectionTargets[collectionKey] = collectionTargetFor(
          playlist.songs,
          'playlist',
          nextCollectionTargets[collectionKey],
        );
      });
      await commitCollectionTargets(nextCollectionTargets);
      for (const song of targets.favorites) {
        if (generation !== automaticGenerationRef.current) return;
        await performDownload(song, 'favorite', 'favorites').catch(() => undefined);
      }
      for (const playlist of targets.playlists) {
        const collectionKey = `playlist:${playlist.id}`;
        for (const song of playlist.songs) {
          if (generation !== automaticGenerationRef.current) return;
          if (!favoriteIds.has(song.id)) {
            await performDownload(song, 'playlist', collectionKey).catch(() => undefined);
          }
        }
      }
    }).catch(() => undefined).finally(() => {
      if (automaticSyncRef.current === sync) automaticSyncRef.current = null;
    });
    automaticSyncRef.current = sync;
    return sync;
  }, [
    commitCollectionTargets,
    enqueueOperation,
    performDownload,
    offlineDataReady,
    supported,
    uid,
  ]);

  useEffect(() => {
    if (offlineDataReady && preferences.enabled && preferences.automatic) {
      void syncAutomaticDownloads();
    }
    return subscribeToLibraryRefresh(() => {
      if (preferencesRef.current.enabled && preferencesRef.current.automatic) {
        void syncAutomaticDownloads();
      }
    });
  }, [
    preferences.automatic,
    preferences.enabled,
    preferences.maxBytes,
    preferences.wifiOnly,
    offlineDataReady,
    syncAutomaticDownloads,
  ]);

  useEffect(() => NetInfo.addEventListener((network) => {
    if (
      network.type === NetInfoStateType.wifi
      && network.isConnected
      && preferencesRef.current.enabled
      && preferencesRef.current.automatic
    ) void syncAutomaticDownloads();
  }), [syncAutomaticDownloads]);

  useEffect(() => subscribeToDataSaver(() => {
    void syncAutomaticDownloads();
  }), [syncAutomaticDownloads]);

  const setMaxBytes = useCallback((value: number) => {
    const maxBytes = Math.max(DOWNLOAD_MIN_BYTES, Math.min(DOWNLOAD_MAX_BYTES, Math.round(value)));
    updatePreferences({ maxBytes });
  }, [updatePreferences]);

  const clearAllDownloads = useCallback(async () => {
    const session = sessionRef.current;
    if (!uid || session.uid !== uid || session.controller.signal.aborted) return;
    automaticGenerationRef.current += 1;
    await enqueueOperation(async () => {
      await clearDownloadedFiles(uid, manifestRef.current);
      if (sessionRef.current !== session || session.controller.signal.aborted) return;
      manifestRef.current = {};
      setManifest({});
      await commitCollectionTargets({});
      setActiveStatuses({});
    });
    if (preferencesRef.current.enabled && preferencesRef.current.automatic) {
      void syncAutomaticDownloads();
    }
  }, [commitCollectionTargets, enqueueOperation, syncAutomaticDownloads, uid]);

  const setAutomatic = useCallback((automatic: boolean) => {
    if (!automatic) automaticGenerationRef.current += 1;
    updatePreferences({ automatic });
  }, [updatePreferences]);

  const setEnabled = useCallback((enabled: boolean) => {
    if (!enabled) automaticGenerationRef.current += 1;
    updatePreferences({ enabled });
  }, [updatePreferences]);

  const setWifiOnly = useCallback((wifiOnly: boolean) => {
    updatePreferences({ wifiOnly });
  }, [updatePreferences]);

  const getPlaybackUri = useCallback((trackId: string) => {
    if (sessionRef.current.uid !== uid || sessionRef.current.controller.signal.aborted) return null;
    const entry = manifestRef.current[trackId];
    if (!entry) return null;
    entry.lastAccessedAt = Date.now();
    if (uid) void saveDownloadManifest(uid, manifestRef.current);
    return entry.uri;
  }, [uid]);

  const statusFor = useCallback((trackId: string): TrackDownloadStatus => {
    const activeStatus = activeStatuses[trackId];
    if (activeStatus) return activeStatus;
    return manifest[trackId]
      ? { state: 'downloaded', progress: 1 }
      : { state: 'not-downloaded', progress: 0 };
  }, [activeStatuses, manifest]);

  const hasCollectionOfflineSongs = useCallback((collectionKey: string) => {
    const target = collectionTargetsRef.current[collectionKey];
    return target?.trackIds.some((trackId) => Boolean(manifestRef.current[trackId])) === true;
  }, []);

  const isCollectionDownloaded = useCallback((collectionKey: string) => {
    const target = collectionTargetsRef.current[collectionKey];
    return Boolean(
      target?.trackIds.length
      && target.trackIds.every((trackId) => Boolean(manifestRef.current[trackId])),
    );
  }, []);

  const isCollectionRequested = useCallback(
    (collectionKey: string) => Boolean(collectionTargetsRef.current[collectionKey]),
    [],
  );

  const isDownloaded = useCallback(
    (trackId: string) => Boolean(manifestRef.current[trackId]),
    [],
  );

  const isTrackKnownUnavailable = useCallback((trackId: string) => (
    Object.values(collectionTargetsRef.current).some(
      (target) => target.unavailableTrackIds?.includes(trackId),
    )
  ), []);

  const isTrackUnavailableForCollection = useCallback((collectionKey: string, trackId: string) => (
    collectionTargetsRef.current[collectionKey]?.unavailableTrackIds?.includes(trackId) === true
  ), []);

  const songsForCollection = useCallback((collectionKey: string) => {
    const target = collectionTargetsRef.current[collectionKey];
    if (!target) return [];
    return target.trackIds.flatMap((trackId) => {
      const entry = manifestRef.current[trackId];
      return entry ? [entry.song] : [];
    });
  }, []);

  const value = useMemo<DownloadContextValue>(() => ({
    ...preferences,
    clearAllDownloads,
    downloadSong,
    downloadSongs,
    downloadedCount: Object.keys(manifest).length,
    downloadedSongs: Object.values(manifest)
      .sort((first, second) => second.downloadedAt - first.downloadedAt)
      .map((entry) => entry.song),
    getPlaybackUri,
    hasCollectionOfflineSongs,
    isCollectionDownloaded,
    isCollectionRequested,
    isDownloaded,
    isTrackKnownUnavailable,
    isTrackUnavailableForCollection,
    ready: offlineDataReady,
    removeDownload,
    setAutomatic,
    setEnabled,
    setMaxBytes,
    setWifiOnly,
    songsForCollection,
    statusFor,
    supported,
    syncAutomaticDownloads,
    usedBytes: manifestBytes(manifest),
  }), [
    clearAllDownloads,
    downloadSong,
    downloadSongs,
    getPlaybackUri,
    hasCollectionOfflineSongs,
    isCollectionDownloaded,
    isCollectionRequested,
    isDownloaded,
    isTrackKnownUnavailable,
    isTrackUnavailableForCollection,
    manifest,
    preferences,
    offlineDataReady,
    removeDownload,
    setAutomatic,
    setEnabled,
    setMaxBytes,
    setWifiOnly,
    songsForCollection,
    statusFor,
    supported,
    syncAutomaticDownloads,
  ]);

  return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>;
}

export function useDownloads() {
  const context = useContext(DownloadContext);
  if (!context) throw new Error('useDownloads must be used inside DownloadProvider.');
  return context;
}
