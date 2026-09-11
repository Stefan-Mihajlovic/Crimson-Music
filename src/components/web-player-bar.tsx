import ArtworkImage from '@/components/artwork-image';
import { useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import MiniPlayer from '@/components/mini-player';
import { formatPlayerTime, PlayerIconButton, PlayerRange, WebTransport, WebVolume } from '@/components/web-player-controls';
import { useWebPointerDrag } from '@/hooks/use-web-pointer-drag';
import { beginWebPlayerMotion, cancelWebPlayerMotion, moveWebPlayerMotion, settleWebPlayerMotion, type WebPlayerMotionSession } from '@/services/web-player-motion';
import { releaseWebNavigationFocus } from '@/services/action-sheet';

export default function WebPlayerBar({ desktopLeft = 280, mobileBottom = 86, hidden = false }: { desktopLeft?: number; mobileBottom?: number; hidden?: boolean }) {
  const player = usePlayer();
  const status = usePlayerStatus();
  const { colors, isDark, performanceMode, reduceMotion } = useAppSettings();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const { currentSong, togglePlay, playNext, playPrevious, seekTo } = player;
  const collapsedTop = Math.max(1, height - mobileBottom - 52);
  const dragOrigin = useRef(collapsedTop);
  const motionSession = useRef<WebPlayerMotionSession | undefined>(undefined);
  useLayoutEffect(() => {
    // Returning to the mini player ends any gesture belonging to its old route.
    if (!hidden) cancelWebPlayerMotion(motionSession.current);
  }, [hidden]);
  useLayoutEffect(() => () => cancelWebPlayerMotion(motionSession.current), []);
  const drag = useWebPointerDrag({
    axis: 'y', direction: 'negative',
    canStart: (target) => Boolean(target.closest('.crimson-mini-track')),
    onStart: () => {
      dragOrigin.current = collapsedTop;
      motionSession.current = beginWebPlayerMotion(collapsedTop, collapsedTop);
      releaseWebNavigationFocus();
      router.push('/player');
    },
    onMove: (distance) => moveWebPlayerMotion(motionSession.current, dragOrigin.current + distance),
    onEnd: ({ distance, velocity, cancelled }) => {
      const open = !cancelled && (distance < -Math.min(150, dragOrigin.current * 0.3) || velocity < -0.45);
      settleWebPlayerMotion(motionSession.current, open, reduceMotion, open ? undefined : () => router.canGoBack() ? router.back() : router.replace('/'));
    },
  });
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
  if (!currentSong || hidden) return null;
  const openPlayer = () => {
    releaseWebNavigationFocus();
    if (width < 960 && !reduceMotion) {
      motionSession.current = beginWebPlayerMotion(collapsedTop, collapsedTop);
      router.push('/player');
      settleWebPlayerMotion(motionSession.current, true, false, undefined, true);
    } else router.push('/player');
  };
  if (width < 960) return <div onPointerDownCapture={drag.onPointerDown} onClickCapture={drag.onClickCapture} onDragStart={(event) => event.preventDefault()}
    style={{ position: 'absolute', left: 20, right: 20, height: 52, bottom: mobileBottom, zIndex: 30 }}>
    <MiniPlayer onExpand={openPlayer} onBeginExpand={() => {}} onExpandDrag={() => {}} onExpandRelease={() => {}} />
  </div>;
  return (
    <View style={[styles.bar, { left: desktopLeft, borderColor: colors.border }]}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 26, pointerEvents: 'none',
        background: performanceMode ? colors.elevated : isDark ? 'rgba(27,22,35,.58)' : 'rgba(250,247,255,.68)',
        backdropFilter: performanceMode ? undefined : 'blur(26px) saturate(1.6)',
        WebkitBackdropFilter: performanceMode ? undefined : 'blur(26px) saturate(1.6)' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) clamp(208px, 40%, 460px) minmax(0, 1fr)', alignItems: 'center', columnGap: 16 }}>
        <View style={styles.trackSection}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open player for ${currentSong.title}`}
            onPress={openPlayer} style={styles.track}>
            <ArtworkImage artwork={currentSong.artwork} source={currentSong.imageSmall || currentSong.image || require('@/assets/images/home/default-song.webp')}
              contentFit="cover" style={styles.art} />
            <View style={styles.copy}>
              <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{currentSong.title}</Text>
              <Text numberOfLines={1} style={[styles.artist, { color: colors.secondaryText }]}>{currentSong.creator}</Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.middle}>
          <WebTransport />
          <View style={styles.timeline}>
            <Text style={[styles.time, { color: colors.secondaryText }]}>{formatPlayerTime(status.currentTime)}</Text>
            <PlayerRange label="Playback position" value={status.currentTime} max={status.duration} onChange={seekTo} />
            <Text style={[styles.time, { color: colors.secondaryText }]}>{formatPlayerTime(status.duration)}</Text>
          </View>
        </View>
        <View style={styles.tools}>
          <PlayerIconButton label={player.isLiked ? 'Remove from favorites' : 'Add to favorites'}
            icon={player.isLiked ? 'heart.fill' : 'heart'} active={player.isLiked} onPress={() => void player.toggleLike()} size={19} />
          <PlayerIconButton label="Open Up Next" icon="list.bullet" onPress={() => { releaseWebNavigationFocus(); router.push({ pathname: '/player', params: { tab: 'queue' } }); }} size={20} />
          {width >= 1200 ? <WebVolume width={76} /> : null}
          <PlayerIconButton label="Expand player" icon="arrow.up.left.and.arrow.down.right" onPress={openPlayer} size={18} />
        </View>
      </div>
      {player.playbackError ? <Pressable accessibilityRole="button" onPress={player.retryPlayback} style={styles.error}>
        <Text style={{ color: colors.accent, fontSize: 12 }}>Playback interrupted · Retry</Text>
      </Pressable> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  bar: {
    position: 'absolute', bottom: 18, right: 24, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 26, paddingHorizontal: 16, paddingVertical: 12,
    boxShadow: '0 12px 42px rgba(0,0,0,0.32)', zIndex: 30,
  },
  trackSection: { minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  track: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  copy: { flex: 1, minWidth: 0 },
  art: { width: 48, height: 48, borderRadius: 12 },
  title: { fontSize: 13, fontWeight: '700' },
  artist: { marginTop: 3, fontSize: 12 },
  middle: { minWidth: 0, width: '100%', gap: 1 },
  timeline: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 18 },
  time: { fontSize: 10, width: 32, flexShrink: 0, textAlign: 'center', fontVariant: ['tabular-nums'] },
  tools: { minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  error: { alignSelf: 'center', paddingTop: 6 },
});
