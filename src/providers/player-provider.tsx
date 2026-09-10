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
  Alert,
} from 'react-native';
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

type RepeatMode = 'none' | 'all' | 'one';

type PlayerContextValue = {
  autoplayEnabled: boolean;
  currentSong: CrimsonSong | null;
  playbackError: string | null;
  isLiked: boolean;
  isShuffled: boolean;
  playNext: () => void;
  playPrevious: () => void;
  playSong: (song: CrimsonSong, queue?: CrimsonSong[], source?: string, sourceId?: string) => void;
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
  const [queue, setQueue] = useState<CrimsonSong[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [source, setSource] = useState('Home');
  const [sourceId, setSourceId] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('none');
  const [isPreparing, setIsPreparing] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
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
  const listeningSessionRef = useRef<{ song: CrimsonSong; started: boolean; maxTime: number; completed: boolean; source: string; sourceId: string } | null>(null);

  useEffect(() => {
    // A queue and its pending requests belong to one authenticated session.
    setCurrentSong(null);
    setQueue([]);
    setQueueIndex(-1);
    setSource('Home');
    setSourceId('');
    setIsLiked(false);
    setIsPreparing(false);
    setPlaybackError(null);
    setIsShuffled(false);
    setRepeatMode('none');
    setSpectrumLevels(pausedSpectrum);
    return () => {
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
  }, [audioPlayer, setSpectrumLevels, user?.uid]);

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
      if (!appActiveRef.current) setSpectrumLevels(pausedSpectrum);
    });
    return () => subscription.remove();
  }, [setSpectrumLevels]);

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
  }, []);

  const activateSong = useCallback((song: CrimsonSong, index: number, playedFrom: string, playedFromId = '') => {
    const previousSession = listeningSessionRef.current;
    if (user?.uid && previousSession?.started && !previousSession.completed) {
      const qualifiedAt = Math.min(30, Math.max(10, previousSession.song.duration * 0.5));
      if (previousSession.maxTime < qualifiedAt) {
        void recordListeningEvent(user.uid, 'skip', previousSession.song.id, previousSession.song, {
          source: previousSession.source,
          playlistId: previousSession.sourceId,
          playedSeconds: previousSession.maxTime,
          duration: previousSession.song.duration,
        }).catch(() => undefined);
      }
    }
    const activation = ++activationRef.current;
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    autoplayRequestRef.current += 1;
    likeRequestRef.current += 1;
    spectrumEnvelopeRef.current = [0, 0, 0, 0];
    smoothedSpectrumRef.current = pausedSpectrum;
    setSpectrumLevels(pausedSpectrum);
    // A finished source can keep reporting didJustFinish while its replacement
    // is being installed. Keep that event latched until a fresh status arrives.
    handledFinishRef.current = didJustFinishRef.current;
    setIsPreparing(true);
    setPlaybackError(null);
    setCurrentSong(song);
    setIsLiked(false);
    setQueueIndex(index);
    setSource(playedFrom);
    setSourceId(playedFromId);
    audioPlayer.pause();
    listeningSessionRef.current = { song, started: false, maxTime: 0, completed: false, source: playedFrom, sourceId: playedFromId };
    const offlineUri = getPlaybackUri(song.id);
    const failPlayback = () => {
      if (activation !== activationRef.current) return;
      audioPlayer.pause();
      audioPlayer.replace(null);
      audioPlayer.clearLockScreenControls();
      loadedActivationRef.current = 0;
      setIsPreparing(false);
      setPlaybackError('This song could not be loaded. Check your connection and tap Play to retry.');
      Alert.alert('Playback unavailable', 'This song could not be loaded. Check your connection and tap Play to retry.');
    };
    void Promise.all([
      ensureMusicAudioSession().catch(() => undefined),
      offlineUri ? Promise.resolve(offlineUri) : resolveTrackPlaybackUrl(song),
    ]).then(async ([, audioUrl]) => {
      if (activation !== activationRef.current) return;
      if (!audioUrl) {
        failPlayback();
        return;
      }
      const headers = await audiusMediaHeaders(audioUrl);
      if (activation !== activationRef.current) return;
      audioPlayer.replace({ uri: audioUrl, name: song.title, ...(headers ? { headers } : {}) });
      loadedActivationRef.current = activation;
      // Handle each loop as a fresh listening session, including completion.
      audioPlayer.loop = false;
      audioPlayer.setActiveForLockScreen(true, {
        title: song.title,
        artist: song.creator,
        albumTitle: `Playing from ${playedFrom}`,
        artworkUrl: normalizeRemoteImageUrl(song.image || song.imageSmall),
      }, {
        isLiveStream: false,
      });
      audioPlayer.play();
      const watchUntilLoaded = (attempt = 0) => {
        if (activation !== activationRef.current) return;
        if (audioPlayer.isLoaded) {
          setIsPreparing(false);
          return;
        }
        if (attempt >= 150) { failPlayback(); return; }
        loadingTimerRef.current = setTimeout(() => watchUntilLoaded(attempt + 1), 80);
      };
      loadingTimerRef.current = setTimeout(() => watchUntilLoaded(), 80);
    }).catch(failPlayback);
  }, [audioPlayer, getPlaybackUri, setSpectrumLevels, user?.uid]);

  const playSong = useCallback((song: CrimsonSong, nextQueue: CrimsonSong[] = [song], playedFrom = 'Home', playedFromId = '') => {
    const normalizedQueue = nextQueue.length ? nextQueue : [song];
    const index = Math.max(0, normalizedQueue.findIndex((item) => item.id === song.id));
    setQueue(normalizedQueue);
    activateSong(song, index, playedFrom, playedFromId);
  }, [activateSong]);

  const playNext = useCallback(() => {
    if (!queue.length) return;
    let nextIndex = isShuffled && queue.length > 1
      ? Math.floor(Math.random() * queue.length)
      : queueIndex + 1;
    if (nextIndex === queueIndex && queue.length > 1) nextIndex = (nextIndex + 1) % queue.length;
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') nextIndex = 0;
      else if (autoplayEnabled && currentSong) {
        const activation = activationRef.current;
        const request = ++autoplayRequestRef.current;
        loadRelatedSongs(currentSong.id)
          .then((related) => {
            if (activation !== activationRef.current || request !== autoplayRequestRef.current) return;
            const autoplayQueue = related.filter((song) => song.id !== currentSong.id);
            if (!autoplayQueue.length) {
              audioPlayer.pause();
              return;
            }
            setQueue(autoplayQueue);
            activateSong(autoplayQueue[0], 0, 'Autoplay', '');
          })
          .catch(() => {
            if (activation === activationRef.current && request === autoplayRequestRef.current) audioPlayer.pause();
          });
        return;
      } else {
        audioPlayer.pause();
        return;
      }
    }
    activateSong(queue[nextIndex], nextIndex, source, sourceId);
  }, [activateSong, audioPlayer, autoplayEnabled, currentSong, isShuffled, queue, queueIndex, repeatMode, source, sourceId]);

  const playPrevious = useCallback(() => {
    if (audioPlayer.currentTime > 3) {
      void audioPlayer.seekTo(0);
      return;
    }
    if (!queue.length) return;
    let previousIndex = queueIndex - 1;
    if (previousIndex < 0) previousIndex = repeatMode === 'all' ? queue.length - 1 : 0;
    activateSong(queue[previousIndex], previousIndex, source, sourceId);
  }, [activateSong, audioPlayer, queue, queueIndex, repeatMode, source, sourceId]);

  useEffect(() => {
    const session = listeningSessionRef.current;
    if (isPreparing || loadedActivationRef.current !== activationRef.current) return;
    if (session && currentSong?.id === session.song.id && status.isLoaded) {
      if (status.playing && !session.started) {
        session.started = true;
        if (user?.uid) void recordListeningEvent(user.uid, 'play', session.song.id, session.song, {
          source: session.source,
          playlistId: session.sourceId,
        }).catch(() => undefined);
      }
      session.maxTime = Math.max(session.maxTime, status.currentTime || 0);
    }
  }, [currentSong?.id, isPreparing, status.currentTime, status.isLoaded, status.playing, user?.uid]);

  useEffect(() => {
    if (!status.didJustFinish) {
      handledFinishRef.current = false;
      return;
    }
    if (handledFinishRef.current || isPreparing || loadedActivationRef.current !== activationRef.current) return;
    handledFinishRef.current = true;
    const session = listeningSessionRef.current;
    if (user?.uid && session?.started && !session.completed) {
      session.completed = true;
      void recordListeningEvent(user.uid, 'complete', session.song.id, session.song, {
        source: session.source,
        playlistId: session.sourceId,
        playedSeconds: Math.max(session.maxTime, session.song.duration),
        duration: session.song.duration,
      }).catch(() => undefined);
    }
    if (repeatMode === 'one' && currentSong) activateSong(currentSong, queueIndex, source, sourceId);
    else playNext();
  }, [activateSong, currentSong, isPreparing, playNext, queueIndex, repeatMode, source, sourceId, status.didJustFinish, user?.uid]);

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
  }, [currentSong, user?.uid]);

  const togglePlay = useCallback(() => {
    if (!currentSong) return;
    autoplayRequestRef.current += 1;
    if (playbackError) {
      activateSong(currentSong, queueIndex, source, sourceId);
      return;
    }
    if (audioPlayer.playing) audioPlayer.pause();
    else audioPlayer.play();
  }, [activateSong, audioPlayer, currentSong, playbackError, queueIndex, source, sourceId]);

  const seekTo = useCallback((seconds: number) => {
    const duration = audioPlayer.duration || currentSong?.duration || seconds;
    void audioPlayer.seekTo(Math.max(0, Math.min(seconds, duration)));
  }, [audioPlayer, currentSong?.duration]);

  const toggleLike = useCallback(async () => {
    if (!currentSong || !user?.uid || likeMutationRef.current) return;
    likeMutationRef.current = true;
    const request = ++likeRequestRef.current;
    try {
      const liked = await toggleUserCollectionItem(user.uid, 'LikedSongs', currentSong.id, currentSong);
      if (request === likeRequestRef.current) setIsLiked(liked);
      requestLibraryRefresh();
    } finally {
      likeMutationRef.current = false;
    }
  }, [currentSong, user?.uid]);

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
    setIsShuffled((current) => !current);
  }, []);

  const value = useMemo<PlayerContextValue>(() => ({
    autoplayEnabled,
    currentSong,
    playbackError,
    isLiked,
    isShuffled,
    playNext,
    playPrevious,
    playSong,
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
  }), [autoplayEnabled, currentSong, playbackError, isLiked, isShuffled, playNext, playPrevious, playSong, queue, queueIndex, repeatMode, seekTo, source, sourceId, toggleAutoplay, toggleLike, togglePlay, toggleRepeat, toggleShuffle]);
  const publicStatus = useMemo<AudioStatus>(() => {
    if (playbackError) return { ...status, playing: false, isLoaded: false, isBuffering: false };
    if (isPreparing) {
      return {
        ...status,
        currentTime: 0,
        duration: currentSong?.duration || 0,
        isBuffering: true,
        isLoaded: false,
        isLive: false,
        playing: false,
        currentOffsetFromLive: null,
      };
    }
    const knownDuration = Number.isFinite(status.duration) && status.duration > 0 ? status.duration : 0;
    const duration = knownDuration || currentSong?.duration || 0;
    return duration === status.duration && !status.isLive
      ? status
      : { ...status, duration, isLive: false, currentOffsetFromLive: null };
  }, [currentSong?.duration, isPreparing, playbackError, status]);

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
