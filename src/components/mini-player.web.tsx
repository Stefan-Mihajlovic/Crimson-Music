import ArtworkImage from '@/components/artwork-image';
import { ActivityIndicator } from 'react-native';

import { SymbolView } from '@/components/app-symbol';
import type { MiniPlayerGestureProps } from '@/components/mini-player';
import { SwipeableSongCopy } from '@/components/song-swipe-pager';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';

/** The Android compact player's layout, with browser pointer ownership above it. */
export default function MiniPlayer({ disabled, onExpand }: MiniPlayerGestureProps) {
  const player = usePlayer();
  const status = usePlayerStatus();
  const { colors, isDark, performanceMode } = useAppSettings();
  const song = player.currentSong;
  if (!song) return null;
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  return <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 52, width: '100%', position: 'relative', overflow: 'hidden', borderRadius: 26, padding: '0 14px', boxSizing: 'border-box',
    background: performanceMode ? colors.elevated : isDark ? 'rgba(31,26,40,.66)' : 'rgba(250,246,255,.72)', backdropFilter: performanceMode ? undefined : 'blur(24px) saturate(1.5)', WebkitBackdropFilter: performanceMode ? undefined : 'blur(24px) saturate(1.5)',
    boxShadow: '0 6px 20px rgba(0,0,0,.15)', pointerEvents: disabled ? 'none' : 'auto', userSelect: 'none' }}>
    <div aria-hidden style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 2, background: 'rgba(255,255,255,.18)' }}><div style={{ width: `${progress * 100}%`, height: 2, background: '#D0A5FF' }} /></div>
    <button type="button" className="crimson-mini-track" aria-label={`Open player for ${song.title}`} onClick={onExpand}
      style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1, height: '100%', gap: 8, border: 0, background: 'transparent', textAlign: 'left', padding: 0, cursor: 'pointer', touchAction: 'none' }}>
      <ArtworkImage artwork={song.artwork} source={song.imageSmall || song.image || require('@/assets/images/home/default-song.webp')} contentFit="cover" style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }} />
      <SwipeableSongCopy enabled={!disabled} />
    </button>
    <button type="button" aria-label={player.isLiked ? 'Remove current song from favorites' : 'Add current song to favorites'} onClick={() => void player.toggleLike()}
      style={{ width: 40, height: 46, flexShrink: 0, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <SymbolView name={player.isLiked ? 'heart.fill' : 'heart'} size={21} tintColor={player.isLiked ? colors.accent : colors.text} />
    </button>
    <button type="button" aria-label={status.isBuffering ? 'Cancel loading' : status.playing ? 'Pause' : 'Play'} onClick={player.playbackState === 'error' ? player.retryPlayback : player.togglePlay}
      style={{ width: 40, height: 46, flexShrink: 0, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      {status.isBuffering ? <ActivityIndicator color={colors.text} size="small" /> : <SymbolView name={status.playing ? 'pause.fill' : 'play.fill'} size={20} tintColor={colors.text} />}
    </button>
  </div>;
}
