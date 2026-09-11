import { audiusMediaHeaders } from '@/services/audius-session';
/* eslint-disable react-hooks/set-state-in-effect */

import {
  AudioSample,
  AudioStatus,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus as useExpoAudioPlayerStatus,
} from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppState,
  Platform,
} from 'react-native';
import { Alert } from '@/services/alert';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { useAuth } from '@/providers/auth-provider';
import { useDownloads } from '@/providers/download-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { createValueStore } from '@/services/value-store';
import {
  CrimsonSong,
  getUserCollectionState,
  loadRelatedSongs,
  normalizeRemoteImageUrl,
  recordListeningEvent,
  resolveTrackPlaybackUrl,
  toggleUserCollectionItem,
} from '@/services/music';
import { configureRemoteControls, subscribeToRemoteControls } from '@/services/remote-controls';
import { requestLibraryRefresh } from '@/services/navigation-events';
import { ListeningClock, restorePlaybackSession, savePlaybackSession, shuffledSongs, subscribeToListeningHistoryReset, type PlaybackSnapshot } from '@/services/playback-session';
import { isAccountDeleted } from '@/services/account-lifecycle';

type RepeatMode = 'none' | 'all' | 'one';
export type PlaybackState = 'idle' | 'restored' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';

type PlayerContextValue = {
  autoplayEnabled: boolean;
  currentSong: CrimsonSong | null;
  playbackError: string | null;
  playbackState: PlaybackState;
  volume: number;
  setVolume: (volume: number) => void;
  nextSong: CrimsonSong | null;
  previousSong: CrimsonSong | null;
  isLiked: boolean;
  isShuffled: boolean;
  playNext: () => void;
  playPrevious: () => void;
  playSong: (song: CrimsonSong, queue?: CrimsonSong[], source?: string, sourceId?: string, shuffle?: boolean) => void;
  playNextInQueue: (song: CrimsonSong) => void;
  addToQueue: (song: CrimsonSong) => void;
  removeFromQueue: (index: number) => void;
  moveQueueItem: (from: number, to: number) => void;
  playQueueIndex: (index: number) => void;
  retryPlayback: () => void;
  queue: CrimsonSong[];
  queueIndex: number;
  repeatMode: RepeatMode;
  seekTo: (seconds: number) => void;
  source: string;
  sourceId: string;
  toggleAutoplay: () => void;
  toggleLike: () => Promise<void>;
  togglePlay: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);
const PlayerStatusContext = createContext<AudioStatus | null>(null);
const pausedSpectrum = [0.36, 0.36, 0.36, 0.36];
const PlayerSpectrumContext = createContext(createValueStore(pausedSpectrum));
const autoplayStorageKey = 'crimson.player.autoplay.v1';
const volumeStorageKey = 'crimson.player.volume.v1';
let audioSessionConfiguration: Promise<void> | null = null;
const inactiveRemoteControls = {
  active: false,
  canGoNext: false,
  canGoPrevious: false,
  duration: 0,
  elapsedTime: 0,
  liked: false,
  playing: false,
};

function ensureMusicAudioSession() {
  // Expo restores real audio interruptions and media-service resets natively.
  // App focus changes must not reapply AVAudioSession's category during playback.
  if (!audioSessionConfiguration) {
    audioSessionConfiguration = setAudioModeAsync({
      allowsRecording: false,
      interruptionMode: 'doNotMix',
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
    }).catch((error) => {
      audioSessionConfiguration = null;
      throw error;
    });
  }
  return audioSessionConfiguration;
}

function spectrumFromAudioSample(sample: AudioSample) {
  const channels = sample.channels.filter((channel) => channel.frames.length);
  if (!channels.length) return null;
  const availableFrames = Math.min(...channels.map((channel) => channel.frames.length));
  const frameCount = Math.min(512, availableFrames);
  if (!Number.isFinite(frameCount) || frameCount < pausedSpectrum.length) return null;
  const frameOffset = availableFrames - frameCount;
  const segmentSize = Math.max(1, Math.floor(frameCount / pausedSpectrum.length));

  return pausedSpectrum.map((_, index) => {
    const start = frameOffset + index * segmentSize;
    const end = index === pausedSpectrum.length - 1
      ? availableFrames
      : Math.min(availableFrames, start + segmentSize);
    let energy = 0;
    let peak = 0;
    let values = 0;
    channels.forEach((channel) => {
      for (let frameIndex = start; frameIndex < end; frameIndex += 1) {
        const amplitude = Math.abs(channel.frames[frameIndex] || 0);
        energy += amplitude * amplitude;
        peak = Math.max(peak, amplitude);
        values += 1;
      }
    });
    const rms = values ? Math.sqrt(energy / values) : 0;
    return rms * 0.78 + peak * 0.22;
  });
}

export function PlayerProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { getPlaybackUri } = useDownloads();
  const { performanceMode, reduceMotion } = useAppSettings();
  const appActiveRef = useRef(AppState.currentState === 'active');
  const audioPlayer = useAudioPlayer(null, {
    keepAudioSessionActive: true,
    preferredForwardBufferDuration: 4,
    updateInterval: 100,
  });
  const status = useExpoAudioPlayerStatus(audioPlayer);
  const playingRef = useRef(status.playing);
  const didJustFinishRef = useRef(status.didJustFinish);
  const [currentSong, setCurrentSong] = useState<CrimsonSong | null>(null);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [volume, setVolumeState] = useState(1);
  const [queue, setQueue] = useState<CrimsonSong[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [source, setSource] = useState('Home');
  const [sourceId, setSourceId] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [isPreparing, setIsPreparing] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [restoredPosition, setRestoredPosition] = useState<number | null>(null);
  const [resumeReady, setResumeReady] = useState(false);
  const [autoplayCandidates, setAutoplayCandidates] = useState<CrimsonSong[]>([]);
  const autoplayCandidatesRef = useRef<CrimsonSong[]>([]);
  const [spectrumStore] = useState(() => createValueStore(pausedSpectrum));
  const setSpectrumLevels = spectrumStore.publish;
  const handledFinishRef = useRef(false);
  const activationRef = useRef(0);
  const autoplayRequestRef = useRef(0);
  const likeRequestRef = useRef(0);
  const likeMutationRef = useRef(false);
  const loadedActivationRef = useRef(0);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSpectrumUpdateRef = useRef(0);
  const spectrumEnvelopeRef = useRef([0, 0, 0, 0]);
  const smoothedSpectrumRef = useRef(pausedSpectrum);
  const listeningSessionRef = useRef<{ id: string; day: string; dayEndsAt: number; song: CrimsonSong; started: boolean; clock: ListeningClock; reported: number; completed: boolean; source: string; sourceId: string; uid: string } | null>(null);
  const queueRef = useRef<CrimsonSong[]>([]);
  const indexRef = useRef(-1);
  const originalOrderRef = useRef<string[]>([]);
  const snapshotRef = useRef<PlaybackSnapshot | null>(null);
  const lastSavedAt = useRef(0);
  const desiredPlaying = useRef(false);
  const restoreRevision = useRef(0);

  const flushListening = useCallback(() => {
    const session = listeningSessionRef.current;
    if (!session?.started || session.clock.seconds <= session.reported || isAccountDeleted(session.uid)) return;
    session.reported = session.clock.seconds;
    void recordListeningEvent(session.uid, 'sessionEnd', session.song.id, session.song, {
      sessionId: session.id, source: session.source, playlistId: session.sourceId,
      playedSeconds: session.clock.seconds, duration: session.song.duration,
      occurredAt: Math.min(Date.now(), session.dayEndsAt),
    }).catch(() => undefined);
  }, []);

  const persistPlayback = useCallback(() => {
    if (!user?.uid || !snapshotRef.current) return;
    const position = restoredPosition ?? (Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0);
    void savePlaybackSession(user.uid, { ...snapshotRef.current, position }).catch(() => undefined);
    lastSavedAt.current = Date.now();
  }, [audioPlayer, restoredPosition, user]);

  const updateQueue = useCallback((songs: CrimsonSong[], index: number) => {
    // A late autoplay response must not overwrite songs manually inserted or
    // reordered while its request was in flight.
    autoplayRequestRef.current += 1;
    queueRef.current = songs;
    indexRef.current = index;
    setQueue(songs);
    setQueueIndex(index);
  }, []);

  useEffect(() => subscribeToListeningHistoryReset((uid) => {
    const session = listeningSessionRef.current;
    if (session?.uid !== uid) return;
    session.id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    session.clock = new ListeningClock();
    session.reported = 0;
    session.started = false;
    session.completed = false;
  }), []);

  useEffect(() => {
    // A queue and its pending requests belong to one authenticated session.
    setCurrentSong(null);
    updateQueue([], -1);
    setSource('Home');
    setSourceId('');
    setIsLiked(false);
    setIsPreparing(false);
    setPlaybackError(null);
    setRestoredPosition(null);
    setResumeReady(false);
    autoplayCandidatesRef.current = [];
    setAutoplayCandidates([]);
    setIsShuffled(false);
    setRepeatMode('none');
    setSpectrumLevels(pausedSpectrum);
    snapshotRef.current = null;
    desiredPlaying.current = false;
    const revision = ++restoreRevision.current;
    let active = true;
    if (user?.uid) void restorePlaybackSession(user.uid).then((saved) => {
      if (!active || revision !== restoreRevision.current) return;
      if (saved) {
        updateQueue(saved.queue, saved.index);
        originalOrderRef.current = saved.originalOrder || saved.queue.map((song) => song.id);
        setCurrentSong(saved.queue[saved.index]);
        setSource(saved.source);
        setSourceId(saved.sourceId);
        setRepeatMode(saved.repeat);
        setIsShuffled(saved.shuffled);
        setRestoredPosition(saved.position);
        snapshotRef.current = saved;
      }
      setResumeReady(true);
    });
    else setResumeReady(true);
    return () => {
      active = false;
      flushListening();
      if (user?.uid && snapshotRef.current) {
        let position = snapshotRef.current.position;
        try {
          if (loadedActivationRef.current === activationRef.current && audioPlayer.isLoaded) position = audioPlayer.currentTime;
        } catch { /* The native object can already be disposed during unmount. */ }
        void savePlaybackSession(user.uid, { ...snapshotRef.current, position }).catch(() => undefined);
      }
      activationRef.current += 1;
      autoplayRequestRef.current += 1;
      likeRequestRef.current += 1;
      loadedActivationRef.current = 0;
      listeningSessionRef.current = null;
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      try {
        audioPlayer.pause();
        audioPlayer.clearLockScreenControls();
      } catch {
        // useAudioPlayer may have already released its native object on unmount.
      }
      configureRemoteControls(inactiveRemoteControls);
    };
  }, [audioPlayer, flushListening, setSpectrumLevels, updateQueue, user?.uid]);

  const handleAudioSample = useCallback((sample: AudioSample) => {
    if (!appActiveRef.current || !playingRef.current || !spectrumStore.hasSubscribers()) return;
    const now = Date.now();
    if (now - lastSpectrumUpdateRef.current < 100) return;
    const spectrum = spectrumFromAudioSample(sample);
    if (!spectrum) return;
    lastSpectrumUpdateRef.current = now;
    const strongestLevel = Math.max(...spectrum, 0.000_001);
    const normalized = spectrum.map((level, index) => {
      const previousEnvelope = spectrumEnvelopeRef.current[index];
      const envelope = previousEnvelope <= 0
        ? level
        : previousEnvelope + (level - previousEnvelope) * (level > previousEnvelope ? 0.34 : 0.025);
      spectrumEnvelopeRef.current[index] = Math.max(envelope, 0.000_001);
      const adaptiveLevel = level / (spectrumEnvelopeRef.current[index] * 1.35);
      const localContrast = level / strongestLevel;
      return Math.max(0.16, Math.min(0.92, 0.14 + adaptiveLevel * 0.36 + localContrast * 0.18));
    });
    const smoothed = normalized.map((level, index) => (
      smoothedSpectrumRef.current[index] * 0.42 + level * 0.58
    ));
    smoothedSpectrumRef.current = smoothed;
    setSpectrumLevels(smoothed);
  }, [setSpectrumLevels, spectrumStore]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      appActiveRef.current = state === 'active';
      if (!appActiveRef.current) {
        setSpectrumLevels(pausedSpectrum);
        flushListening();
        persistPlayback();
      }
    });
    return () => subscription.remove();
  }, [flushListening, persistPlayback, setSpectrumLevels]);

  useEffect(() => {
    playingRef.current = status.playing;
    if (!status.playing) setSpectrumLevels(pausedSpectrum);
  }, [setSpectrumLevels, status.playing]);

  useEffect(() => {
    if (!audioPlayer.isAudioSamplingSupported || performanceMode || reduceMotion) {
      setSpectrumLevels(pausedSpectrum);
      return;
    }
    // Installing/removing Expo's iOS audio tap changes AVPlayerItem.audioMix.
    // Keep it stable across focus, buffering and pause transitions: only gate
    // visual updates above, without touching an otherwise uninterrupted stream.
    audioPlayer.setAudioSamplingEnabled(true);
    const subscription = audioPlayer.addListener('audioSampleUpdate', handleAudioSample);
    return () => {
      subscription.remove();
      try { audioPlayer.setAudioSamplingEnabled(false); } catch { /* Native player already disposed. */ }
    };
  }, [audioPlayer, handleAudioSample, performanceMode, reduceMotion, setSpectrumLevels]);

  useEffect(() => {
    didJustFinishRef.current = status.didJustFinish;
  }, [status.didJustFinish]);

  useEffect(() => {
    void ensureMusicAudioSession().catch(() => undefined);
    AsyncStorage.getItem(autoplayStorageKey)
      .then((stored) => {
        if (stored === 'off') setAutoplayEnabled(false);
      })
      .catch(() => undefined);
    void AsyncStorage.getItem(volumeStorageKey).then((stored) => {
      if (stored !== null && Number.isFinite(Number(stored))) setVolumeState(Math.max(0, Math.min(1, Number(stored))));
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    // Expo exposes native volume as an imperative property setter, not React state.
    // eslint-disable-next-line react-hooks/immutability
    audioPlayer.volume = volume;
  }, [audioPlayer, volume]);
  const setVolume = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.max(0, Math.min(1, value));
    setVolumeState(next);
    void AsyncStorage.setItem(volumeStorageKey, String(next)).catch(() => undefined);
  }, []);

  const activateSong = useCallback((song: CrimsonSong, index: number, playedFrom: string, playedFromId = '', resumeAt = 0, preserveSession = false) => {
    restoreRevision.current += 1;
    setResumeReady(true);
    const previousSession = listeningSessionRef.current;
    if (!preserveSession) {
      flushListening();
      if (previousSession?.started && !previousSession.completed
        && previousSession.clock.seconds < Math.min(30, Math.max(10, previousSession.song.duration * 0.5))) {
        void recordListeningEvent(previousSession.uid, 'skip', previousSession.song.id, previousSession.song, {
          sessionId: previousSession.id, source: previousSession.source, playlistId: previousSession.sourceId,
          playedSeconds: previousSession.clock.seconds, duration: previousSession.song.duration,
        }).catch(() => undefined);
      }
      listeningSessionRef.current = user?.uid ? {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, day: new Date().toDateString(), dayEndsAt: new Date().setHours(23, 59, 59, 999), song, started: false,
        clock: new ListeningClock(), reported: 0, completed: false,
        source: playedFrom, sourceId: playedFromId, uid: user.uid,
      } : null;
    } else previousSession?.clock.seek();
    const activation = ++activationRef.current;
    autoplayCandidatesRef.current = [];
    setAutoplayCandidates([]);
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    autoplayRequestRef.current += 1;
    likeRequestRef.current += 1;
    spectrumEnvelopeRef.current = [0, 0, 0, 0];
    smoothedSpectrumRef.current = pausedSpectrum;
    setSpectrumLevels(pausedSpectrum);
    handledFinishRef.current = didJustFinishRef.current;
    desiredPlaying.current = true;
    setIsPreparing(true);
    setPlaybackError(null);
    setRestoredPosition(Math.max(0, resumeAt));
    setCurrentSong(song);
    setIsLiked(false);
    indexRef.current = index;
    setQueueIndex(index);
    setSource(playedFrom);
    setSourceId(playedFromId);
    audioPlayer.pause();
    const failPlayback = () => {
      if (activation !== activationRef.current) return;
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      audioPlayer.pause();
      flushListening();
      desiredPlaying.current = false;
      loadedActivationRef.current = 0;
      setIsPreparing(false);
      setPlaybackError('The stream could not be loaded. Retry from this position or skip to the next song.');
    };
    loadingTimerRef.current = setTimeout(failPlayback, 25_000);
    const offlineUri = getPlaybackUri(song.id);
    void Promise.all([
      ensureMusicAudioSession(),
      offlineUri ? Promise.resolve(offlineUri) : resolveTrackPlaybackUrl(song),
    ]).then(async ([, audioUrl]) => {
      if (activation !== activationRef.current) return;
      if (!audioUrl) { failPlayback(); return; }
      const headers = await audiusMediaHeaders(audioUrl);
      if (activation !== activationRef.current) return;
      audioPlayer.replace({ uri: audioUrl, name: song.title, ...(headers ? { headers } : {}) });
      audioPlayer.loop = false;
      // WebPlayerBar owns browser MediaSession. Expo's default web next/previous
      // handlers would otherwise replace the app's deterministic queue controls.
      if (Platform.OS !== 'web') audioPlayer.setActiveForLockScreen(true, {
        title: song.title, artist: song.creator, albumTitle: `Playing from ${playedFrom}`,
        artworkUrl: normalizeRemoteImageUrl(song.image || song.imageSmall),
      }, { isLiveStream: false });
      const startedAt = Date.now();
      const ready = async () => {
        if (activation !== activationRef.current) return;
        if (!audioPlayer.isLoaded) {
          if (Date.now() - startedAt > 25_000) { failPlayback(); return; }
          loadingTimerRef.current = setTimeout(() => void ready(), 150);
          return;
        }
        try {
          if (resumeAt > 0) await audioPlayer.seekTo(Math.min(resumeAt, Math.max(0, (audioPlayer.duration || song.duration) - 0.5)));
          if (activation !== activationRef.current) return;
          loadedActivationRef.current = activation;
          setRestoredPosition(null);
          setIsPreparing(false);
          if (desiredPlaying.current) audioPlayer.play();
        } catch { failPlayback(); }
      };
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      void ready();
    }).catch(failPlayback);
  }, [audioPlayer, flushListening, getPlaybackUri, setSpectrumLevels, user?.uid]);

  const playSong = useCallback((song: CrimsonSong, nextQueue: CrimsonSong[] = [song], playedFrom = 'Home', playedFromId = '', shuffle = isShuffled) => {
    const unique = [...new Map(nextQueue.map((item) => [item.id, item])).values()];
    if (!unique.some((item) => item.id === song.id)) unique.unshift(song);
    const selected = unique.findIndex((item) => item.id === song.id);
    // Start a fresh listening order at the chosen song. Earlier collection
    // rows stay upcoming, never masquerading as already-played history.
    const ordered = [...unique.slice(selected), ...unique.slice(0, selected)];
    originalOrderRef.current = ordered.map((item) => item.id);
    const normalized = shuffle ? [song, ...shuffledSongs(ordered.slice(1))] : ordered;
    setIsShuffled(shuffle);
    const index = normalized.findIndex((item) => item.id === song.id);
    updateQueue(normalized, index);
    activateSong(song, index, playedFrom, playedFromId);
  }, [activateSong, isShuffled, updateQueue]);

  const playQueueIndex = useCallback((index: number) => {
    const song = queueRef.current[index];
    if (!song) return;
    if (index > indexRef.current + 1) {
      // Choosing a later item plays it next without marking skipped rows as
      // heard. The rest remains available in Up Next, and Previous is truthful.
      const updated = [...queueRef.current];
      updated.splice(index, 1);
      const destination = indexRef.current + 1;
      updated.splice(destination, 0, song);
      updateQueue(updated, destination);
      activateSong(song, destination, source, sourceId);
    } else activateSong(song, index, source, sourceId);
  }, [activateSong, source, sourceId, updateQueue]);

  const playNext = useCallback(() => {
    const songs = queueRef.current;
    const index = indexRef.current;
    if (!songs.length) return;
    if (index + 1 < songs.length) { activateSong(songs[index + 1], index + 1, source, sourceId); return; }
    if (repeatMode === 'all') { activateSong(songs[0], 0, source, sourceId); return; }
    if (autoplayEnabled && currentSong) {
      const activation = activationRef.current;
      const request = ++autoplayRequestRef.current;
      const requestSongs = autoplayCandidatesRef.current.length
        ? Promise.resolve(autoplayCandidatesRef.current)
        : loadRelatedSongs(currentSong.id);
      void requestSongs.then((related) => {
        if (activation !== activationRef.current || request !== autoplayRequestRef.current) return;
        const heard = new Set(songs.map((song) => song.id));
        const candidates = related.filter((song) => song.streamable && !heard.has(song.id));
        if (!candidates.length) { desiredPlaying.current = false; audioPlayer.pause(); return; }
        // Candidates already have a stable preview order. Never re-roll them
        // when a swipe commits, or its displayed next cover would be wrong.
        const upcoming = candidates;
        const updated = [...songs, ...upcoming];
        originalOrderRef.current.push(...upcoming.map((song) => song.id));
        updateQueue(updated, index + 1);
        activateSong(upcoming[0], index + 1, 'Autoplay', '');
      }).catch(() => {
        if (activation === activationRef.current && request === autoplayRequestRef.current) {
          desiredPlaying.current = false;
          audioPlayer.pause();
          setPlaybackError('Autoplay could not find a stream. Retry or choose another song.');
        }
      });
    } else { desiredPlaying.current = false; audioPlayer.pause(); flushListening(); }
  }, [activateSong, audioPlayer, autoplayEnabled, currentSong, flushListening, repeatMode, source, sourceId, updateQueue]);

  useEffect(() => {
    if (!currentSong || !autoplayEnabled || isPreparing || repeatMode === 'all' || queueIndex < queue.length - 1) {
      autoplayCandidatesRef.current = [];
      setAutoplayCandidates([]);
      return;
    }
    let active = true;
    const heard = new Set(queue.map((song) => song.id));
    void loadRelatedSongs(currentSong.id).then((related) => {
      if (!active) return;
      const candidates = related.filter((song) => song.streamable && !heard.has(song.id));
      const ordered = isShuffled ? shuffledSongs(candidates) : candidates;
      autoplayCandidatesRef.current = ordered;
      setAutoplayCandidates(ordered);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [autoplayEnabled, currentSong, isPreparing, isShuffled, queue, queueIndex, repeatMode]);

  const playPrevious = useCallback(() => {
    const songs = queueRef.current;
    const index = indexRef.current > 0 ? indexRef.current - 1 : repeatMode === 'all' ? songs.length - 1 : 0;
    if (songs[index]) activateSong(songs[index], index, source, sourceId);
  }, [activateSong, repeatMode, source, sourceId]);

  const addQueueSong = useCallback((song: CrimsonSong, next: boolean) => {
    if (!queueRef.current.length || indexRef.current < 0) { playSong(song, [song], 'Queue'); return; }
    const updated = [...queueRef.current];
    updated.splice(next ? indexRef.current + 1 : updated.length, 0, song);
    originalOrderRef.current.push(song.id);
    updateQueue(updated, indexRef.current);
  }, [playSong, updateQueue]);
  const playNextInQueue = useCallback((song: CrimsonSong) => addQueueSong(song, true), [addQueueSong]);
  const addToQueue = useCallback((song: CrimsonSong) => addQueueSong(song, false), [addQueueSong]);
  const removeFromQueue = useCallback((index: number) => {
    if (index === indexRef.current || index < 0 || index >= queueRef.current.length) return;
    const updated = queueRef.current.filter((_, position) => position !== index);
    updateQueue(updated, index < indexRef.current ? indexRef.current - 1 : indexRef.current);
  }, [updateQueue]);
  const moveQueueItem = useCallback((from: number, to: number) => {
    if (from <= indexRef.current || to <= indexRef.current || from >= queueRef.current.length || to >= queueRef.current.length) return;
    const updated = [...queueRef.current];
    const [song] = updated.splice(from, 1);
    updated.splice(to, 0, song);
    updateQueue(updated, indexRef.current);
  }, [updateQueue]);

  useEffect(() => {
    if (isPreparing || loadedActivationRef.current !== activationRef.current || restoredPosition !== null) return;
    const session = listeningSessionRef.current;
    if (session && currentSong?.id === session.song.id && status.isLoaded) {
      if (session.day !== new Date().toDateString()) {
        // Checkpoints are day-scoped so a cumulative counter never enters two months.
        flushListening();
        session.id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        session.day = new Date().toDateString();
        session.dayEndsAt = new Date().setHours(23, 59, 59, 999);
        session.clock = new ListeningClock();
        session.reported = 0;
        session.started = false;
      }
      if (status.playing && !session.started) {
        session.started = true;
        void recordListeningEvent(session.uid, 'play', session.song.id, session.song, {
          sessionId: session.id, source: session.source, playlistId: session.sourceId,
        }).catch(() => undefined);
      }
      session.clock.sample(status.currentTime || 0, status.playing && !status.isBuffering);
      if (!status.playing || session.clock.seconds - session.reported >= 15) flushListening();
    }
  }, [audioPlayer, currentSong?.id, flushListening, isPreparing, restoredPosition, status.currentTime, status.isBuffering, status.isLoaded, status.playing]);

  useEffect(() => {
    if (!status.didJustFinish) { handledFinishRef.current = false; return; }
    if (handledFinishRef.current || isPreparing || loadedActivationRef.current !== activationRef.current) return;
    handledFinishRef.current = true;
    const session = listeningSessionRef.current;
    if (session?.started && !session.completed) {
      session.clock.sample(status.currentTime || session.song.duration, false);
      session.completed = true;
      flushListening();
      void recordListeningEvent(session.uid, 'complete', session.song.id, session.song, {
        sessionId: session.id, source: session.source, playlistId: session.sourceId,
        playedSeconds: session.clock.seconds, duration: session.song.duration,
      }).catch(() => undefined);
    }
    if (repeatMode === 'one' && currentSong) activateSong(currentSong, queueIndex, source, sourceId);
    else playNext();
  }, [activateSong, currentSong, flushListening, isPreparing, playNext, queueIndex, repeatMode, source, sourceId, status.currentTime, status.didJustFinish]);

  useEffect(() => {
    const request = ++likeRequestRef.current;
    if (!currentSong || !user?.uid) {
      setIsLiked(false);
      return;
    }
    getUserCollectionState(user.uid, 'LikedSongs', currentSong.id)
      .then((liked) => { if (request === likeRequestRef.current) setIsLiked(liked); })
      .catch(() => { if (request === likeRequestRef.current) setIsLiked(false); });
    return () => { likeRequestRef.current += 1; };
  }, [currentSong, user]);

  const retryPlayback = useCallback(() => {
    if (!currentSong) return;
    const position = restoredPosition ?? (Number.isFinite(audioPlayer.currentTime) ? audioPlayer.currentTime : 0);
    activateSong(currentSong, indexRef.current, source, sourceId, position, Boolean(listeningSessionRef.current));
  }, [activateSong, audioPlayer, currentSong, restoredPosition, source, sourceId]);

  const togglePlay = useCallback(() => {
    if (!currentSong) return;
    autoplayRequestRef.current += 1;
    if (isPreparing) {
      activationRef.current += 1;
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      desiredPlaying.current = false;
      audioPlayer.pause();
      setIsPreparing(false);
      return;
    }
    if (status.isBuffering && desiredPlaying.current) {
      desiredPlaying.current = false;
      audioPlayer.pause();
      flushListening();
      persistPlayback();
      return;
    }
    if (playbackError || restoredPosition !== null || loadedActivationRef.current !== activationRef.current) {
      retryPlayback();
      return;
    }
    // Expo web's playing getter is optimistic even if browser autoplay was
    // denied. Use confirmed status so the next user gesture can start playback.
    const isActuallyPlaying = Platform.OS === 'web' ? status.playing : audioPlayer.playing;
    desiredPlaying.current = !isActuallyPlaying;
    if (isActuallyPlaying) { audioPlayer.pause(); flushListening(); persistPlayback(); }
    else audioPlayer.play();
  }, [audioPlayer, currentSong, flushListening, isPreparing, persistPlayback, playbackError, restoredPosition, retryPlayback, status.isBuffering, status.playing]);

  const seekTo = useCallback((seconds: number) => {
    const duration = audioPlayer.duration || currentSong?.duration || seconds;
    const position = Math.max(0, Math.min(seconds, duration));
    listeningSessionRef.current?.clock.seek();
    if (restoredPosition !== null) setRestoredPosition(position);
    else void audioPlayer.seekTo(position).then(persistPlayback).catch(() => setPlaybackError('This position could not be loaded. Retry to continue.'));
  }, [audioPlayer, currentSong?.duration, persistPlayback, restoredPosition]);

  const toggleLike = useCallback(async () => {
    if (!currentSong || !user?.uid || likeMutationRef.current) return;
    likeMutationRef.current = true;
    const request = ++likeRequestRef.current;
    try {
      const liked = await toggleUserCollectionItem(user.uid, 'LikedSongs', currentSong.id, currentSong);
      if (request === likeRequestRef.current) setIsLiked(liked);
      requestLibraryRefresh();
    } catch {
      Alert.alert('Favorites could not be updated', 'Check your connection and try again.');
    } finally {
      likeMutationRef.current = false;
    }
  }, [currentSong, user]);

  useEffect(() => subscribeToRemoteControls({
    onLike: () => void toggleLike(),
    onNext: playNext,
    onPrevious: playPrevious,
  }), [playNext, playPrevious, toggleLike]);

  useEffect(() => {
    configureRemoteControls({
      active: Boolean(currentSong && !playbackError),
      canGoNext: Boolean(currentSong) && (autoplayEnabled || repeatMode === 'all' || queueIndex < queue.length - 1),
      canGoPrevious: Boolean(currentSong),
      duration: audioPlayer.duration || currentSong?.duration || 0,
      elapsedTime: audioPlayer.currentTime || 0,
      liked: isLiked,
      playing: Boolean(currentSong && status.playing),
    });
  }, [audioPlayer, autoplayEnabled, currentSong, isLiked, playbackError, queue.length, queueIndex, repeatMode, status.playing]);

  useEffect(() => () => configureRemoteControls(inactiveRemoteControls), []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((current) => {
      const next = current === 'none' ? 'all' : current === 'all' ? 'one' : 'none';
      return next;
    });
  }, []);

  const toggleAutoplay = useCallback(() => {
    setAutoplayEnabled((current) => {
      const next = !current;
      void AsyncStorage.setItem(autoplayStorageKey, next ? 'on' : 'off');
      return next;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    const next = !isShuffled;
    const played = queueRef.current.slice(0, indexRef.current + 1);
    const upcoming = queueRef.current.slice(indexRef.current + 1);
    const ordered = next ? shuffledSongs(upcoming) : [...upcoming].sort((first, second) => {
      const firstIndex = originalOrderRef.current.indexOf(first.id);
      const secondIndex = originalOrderRef.current.indexOf(second.id);
      return (firstIndex < 0 ? Infinity : firstIndex) - (secondIndex < 0 ? Infinity : secondIndex);
    });
    updateQueue([...played, ...ordered], indexRef.current);
    setIsShuffled(next);
  }, [isShuffled, updateQueue]);

  useEffect(() => {
    if (!resumeReady || !currentSong || queueIndex < 0) return;
    snapshotRef.current = { queue, index: queueIndex, position: restoredPosition ?? audioPlayer.currentTime ?? 0,
      source, sourceId, shuffled: isShuffled, repeat: repeatMode, originalOrder: originalOrderRef.current };
    persistPlayback();
  }, [audioPlayer, currentSong, isShuffled, persistPlayback, queue, queueIndex, repeatMode, restoredPosition, resumeReady, source, sourceId]);

  useEffect(() => {
    if (!resumeReady || !currentSong || restoredPosition !== null) return;
    if (!status.playing || Date.now() - lastSavedAt.current > 5000) persistPlayback();
  }, [currentSong, persistPlayback, restoredPosition, resumeReady, status.currentTime, status.playing]);

  useEffect(() => {
    if (isPreparing || !status.isBuffering || !desiredPlaying.current || playbackError) return;
    const timer = setTimeout(() => {
      desiredPlaying.current = false;
      audioPlayer.pause();
      flushListening();
      setPlaybackError('Playback lost its connection. Retry to continue from here.');
    }, 20_000);
    return () => clearTimeout(timer);
  }, [audioPlayer, flushListening, isPreparing, playbackError, status.isBuffering]);

  useEffect(() => {
    if (!status.error || !currentSong || isPreparing || playbackError || restoredPosition !== null) return;
    desiredPlaying.current = false;
    audioPlayer.pause();
    flushListening();
    setPlaybackError('This stream is unavailable right now. Retry from here or skip to another song.');
  }, [audioPlayer, currentSong, flushListening, isPreparing, playbackError, restoredPosition, status.error]);

  const nextSong = queue[queueIndex + 1] || (repeatMode === 'all' ? queue[0] : autoplayEnabled ? autoplayCandidates[0] : null) || null;
  const previousSong = queue[queueIndex - 1] || (repeatMode === 'all' ? queue[queue.length - 1] : null) || null;
  const playbackState: PlaybackState = !currentSong ? 'idle' : playbackError ? 'error' : isPreparing ? 'loading'
    : restoredPosition !== null ? 'restored' : status.isBuffering ? 'buffering' : status.playing ? 'playing' : 'paused';

  const value = useMemo<PlayerContextValue>(() => ({
    autoplayEnabled,
    currentSong,
    playbackError,
    playbackState,
    volume,
    setVolume,
    nextSong,
    previousSong,
    isLiked,
    isShuffled,
    playNext,
    playPrevious,
    playSong,
    playNextInQueue,
    addToQueue,
    removeFromQueue,
    moveQueueItem,
    playQueueIndex,
    retryPlayback,
    queue,
    queueIndex,
    repeatMode,
    seekTo,
    source,
    sourceId,
    toggleAutoplay,
    toggleLike,
    togglePlay,
    toggleRepeat,
    toggleShuffle,
  }), [addToQueue, autoplayEnabled, currentSong, playbackError, playbackState, volume, setVolume, nextSong, previousSong, isLiked, isShuffled, moveQueueItem, playNext, playNextInQueue, playPrevious, playQueueIndex, playSong, queue, queueIndex, removeFromQueue, repeatMode, retryPlayback, seekTo, source, sourceId, toggleAutoplay, toggleLike, togglePlay, toggleRepeat, toggleShuffle]);
  const publicStatus = useMemo<AudioStatus>(() => {
    if (playbackError) return { ...status, currentTime: restoredPosition ?? status.currentTime, duration: currentSong?.duration || status.duration, playing: false, isBuffering: false };
    if (isPreparing) {
      return {
        ...status,
        currentTime: restoredPosition || 0,
        duration: currentSong?.duration || 0,
        isBuffering: true,
        isLoaded: false,
        isLive: false,
        playing: false,
        currentOffsetFromLive: null,
      };
    }
    if (restoredPosition !== null) return { ...status, currentTime: restoredPosition, duration: currentSong?.duration || 0, playing: false, isLoaded: false, isBuffering: false };
    const knownDuration = Number.isFinite(status.duration) && status.duration > 0 ? status.duration : 0;
    const duration = knownDuration || currentSong?.duration || 0;
    return duration === status.duration && !status.isLive
      ? status
      : { ...status, duration, isLive: false, currentOffsetFromLive: null };
  }, [currentSong?.duration, isPreparing, playbackError, restoredPosition, status]);

  return (
    <PlayerContext.Provider value={value}>
      <PlayerStatusContext.Provider value={publicStatus}>
        <PlayerSpectrumContext.Provider value={spectrumStore}>{children}</PlayerSpectrumContext.Provider>
      </PlayerStatusContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayer must be used inside PlayerProvider.');
  return value;
}

export function usePlayerStatus() {
  const value = useContext(PlayerStatusContext);
  if (!value) throw new Error('usePlayerStatus must be used inside PlayerProvider.');
  return value;
}

export function usePlayerSpectrum() {
  const store = useContext(PlayerSpectrumContext);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
