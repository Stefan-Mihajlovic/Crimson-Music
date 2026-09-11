import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
const time = (value: number) =>
  `${Math.floor((value || 0) / 60)}:${String(Math.floor((value || 0) % 60)).padStart(2, '0')}`;
export default function WebPlayerBar() {
  const player = usePlayer();
  const status = usePlayerStatus();
  const { colors } = useAppSettings();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { currentSong, togglePlay, playNext, playPrevious, seekTo } = player;
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaSession ||
      typeof MediaMetadata === 'undefined'
    )
      return;
    navigator.mediaSession.metadata = currentSong
      ? new MediaMetadata({
          title: currentSong.title,
          artist: currentSong.creator,
          artwork: currentSong.image ? [{ src: currentSong.image }] : [],
        })
      : null;
  }, [currentSong]);
  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      !currentSong
    )
      return;
    const media = navigator.mediaSession;
    const handlers: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler>
    > = {
      play: () => {
        if (!statusRef.current.playing) togglePlay();
      },
      pause: () => {
        if (statusRef.current.playing) togglePlay();
      },
      nexttrack: playNext,
      previoustrack: playPrevious,
      seekto: (event) => seekTo(event.seekTime || 0),
      seekbackward: (event) =>
        seekTo(
          Math.max(0, statusRef.current.currentTime - (event.seekOffset || 10)),
        ),
      seekforward: (event) =>
        seekTo(
          Math.min(
            statusRef.current.duration,
            statusRef.current.currentTime + (event.seekOffset || 10),
          ),
        ),
    };
    for (const [action, handler] of Object.entries(handlers))
      try {
        media.setActionHandler(action as MediaSessionAction, handler);
      } catch {
        /* Browser does not expose this command. */
      }
    return () => {
      for (const action of Object.keys(handlers))
        try {
          media.setActionHandler(action as MediaSessionAction, null);
        } catch {
          /* Unsupported command. */
        }
    };
  }, [currentSong, playNext, playPrevious, seekTo, togglePlay]);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
    navigator.mediaSession.playbackState = !currentSong
      ? 'none'
      : status.playing
        ? 'playing'
        : 'paused';
    if (currentSong && status.duration > 0)
      try {
        navigator.mediaSession.setPositionState({
          duration: status.duration,
          position: Math.min(status.duration, Math.max(0, status.currentTime)),
          playbackRate: 1,
        });
      } catch {
        /* Position API is optional. */
      }
    if (!currentSong) navigator.mediaSession.metadata = null;
  }, [currentSong, status.currentTime, status.duration, status.playing]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        !currentSong ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        target?.closest(
          'input,textarea,button,select,a,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="slider"],[role="tab"],[role="menuitem"]',
        )
      )
        return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      }
      if (event.code === 'ArrowRight') {
        event.preventDefault();
        if (event.shiftKey) playNext();
        else seekTo(statusRef.current.currentTime + 10);
      }
      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        if (event.shiftKey) playPrevious();
        else seekTo(Math.max(0, statusRef.current.currentTime - 10));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [currentSong, playNext, playPrevious, seekTo, togglePlay]);
  if (!currentSong) return null;
  const button = (
    label: string,
    glyph: string,
    onPress: () => void,
    active = false,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.button}
    >
      <Text
        style={{ color: active ? colors.accent : colors.text, fontSize: 22 }}
      >
        {glyph}
      </Text>
    </Pressable>
  );
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.elevated, borderColor: colors.border },
      ]}
    >
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open player"
          onPress={() => router.push('/player')}
          style={[styles.track, { maxWidth: width < 700 ? 180 : 330 }]}
        >
          <Image
            source={{ uri: currentSong.imageSmall || currentSong.image }}
            style={styles.art}
          />
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color: colors.text, fontWeight: '700' }}
            >
              {currentSong.title}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.secondaryText }}>
              {currentSong.creator}
            </Text>
          </View>
        </Pressable>
        <View style={styles.controls}>
          {width > 600
            ? button('Shuffle', '⤨', player.toggleShuffle, player.isShuffled)
            : null}
          {button('Previous', '⏮', playPrevious)}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={status.playing ? 'Pause' : 'Play'}
            onPress={
              player.playbackState === 'error'
                ? player.retryPlayback
                : togglePlay
            }
            style={styles.play}
          >
            <Text style={{ fontSize: 23, color: '#17131A' }}>
              {status.playing ? 'Ⅱ' : '▶'}
            </Text>
          </Pressable>
          {button('Next', '⏭', playNext)}
          {width > 600
            ? button(
                `Repeat ${player.repeatMode}`,
                '↻',
                player.toggleRepeat,
                player.repeatMode !== 'none',
              )
            : null}
        </View>
        <View style={styles.controls}>
          {width > 550
            ? button(
                player.isLiked ? 'Remove favorite' : 'Favorite',
                player.isLiked ? '♥' : '♡',
                () => void player.toggleLike(),
                player.isLiked,
              )
            : null}
          {button('Open queue', '☷', () => router.push('/player-details'))}
          {width > 850 ? (
            <input
              aria-label="Volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={player.volume}
              onChange={(e) => player.setVolume(Number(e.target.value))}
              style={{ width: 90, accentColor: colors.accent }}
            />
          ) : null}
        </View>
      </View>
      <View style={styles.timeline}>
        <Text style={[styles.time, { color: colors.secondaryText }]}>
          {time(status.currentTime)}
        </Text>
        <input
          aria-label="Playback position"
          type="range"
          min={0}
          max={Math.max(1, status.duration)}
          step={1}
          value={Math.min(status.currentTime, status.duration || 0)}
          onChange={(event) => seekTo(Number(event.target.value))}
          style={{ flex: 1, minWidth: 0, accentColor: colors.accent }}
        />
        <Text style={[styles.time, { color: colors.secondaryText }]}>
          {time(status.duration)}
        </Text>
      </View>
      {player.playbackError ? (
        <Pressable accessibilityRole="button" onPress={player.retryPlayback}>
          <Text style={{ color: colors.accent, textAlign: 'center' }}>
            Playback interrupted · Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  track: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  art: { width: 44, height: 44, borderRadius: 10 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  time: { fontSize: 12, minWidth: 34 },
});
