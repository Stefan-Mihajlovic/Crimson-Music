import ArtworkImage from '@/components/artwork-image';
import { useIsFocused, useRouter } from 'expo-router';
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPlayerArtworkLayout, PlayerContent } from '@/app/player';
import MiniPlayer from '@/components/mini-player';
import PlayerArtworkBackground from '@/components/player-artwork-background';
import { useWebPointerDrag } from '@/hooks/use-web-pointer-drag';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { useDetailRoutes } from '@/services/action-sheet';
import { beginWebPlayerMotion, cancelWebPlayerMotion, getServerWebPlayerMotion, getWebPlayerMotion, getWebPlayerMotionSession, moveWebPlayerMotion, settleWebPlayerMotion, subscribeWebPlayerMotion } from '@/services/web-player-motion';

export default function MobilePlayerSurface() {
  const { currentSong } = usePlayer();
  const { reduceMotion } = useAppSettings();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const focused = useIsFocused();
  const { artistHref } = useDetailRoutes();
  const motion = useSyncExternalStore(subscribeWebPlayerMotion, getWebPlayerMotion, getServerWebPlayerMotion);
  const collapsedTop = Math.max(1, height - Math.max(12, insets.bottom) - 68 - 52);
  const dragOrigin = useRef(0);
  // Adopt the mini player's in-flight gesture when this route mounts. Older
  // route instances may cancel only their own motion, never a newer opening.
  const motionSession = useRef(getWebPlayerMotionSession());
  useLayoutEffect(() => {
    if (!focused) cancelWebPlayerMotion(motionSession.current);
    return () => cancelWebPlayerMotion(motionSession.current);
  }, [focused]);
  const finishClose = () => router.canGoBack() ? router.back() : router.replace('/');
  const close = () => {
    if (!focused) return;
    motionSession.current = beginWebPlayerMotion(motion.position, collapsedTop);
    settleWebPlayerMotion(motionSession.current, false, reduceMotion, finishClose, true);
  };
  const drag = useWebPointerDrag({
    axis: 'y', direction: 'positive',
    canStart: (target) => focused && Boolean(target.closest('[data-testid="player-drag-header"], [data-testid="player-drag-artwork"]'))
      && !target.closest('button,[role="button"],input,textarea,select,[role="slider"]'),
    onStart: () => { dragOrigin.current = motion.position; motionSession.current = beginWebPlayerMotion(motion.position, collapsedTop); },
    onMove: (distance) => moveWebPlayerMotion(motionSession.current, dragOrigin.current + distance),
    onEnd: ({ distance, velocity, cancelled }) => {
      const shouldClose = !cancelled && (distance > Math.min(150, collapsedTop * 0.3) || velocity > 0.5);
      settleWebPlayerMotion(motionSession.current, !shouldClose, reduceMotion, shouldClose ? finishClose : undefined);
    },
  });
  const position = motion.phase === 'rest' ? 0 : motion.position;
  const progress = Math.max(0, Math.min(1, 1 - position / collapsedTop));
  const moving = position > 0;
  const morphing = motion.phase !== 'rest';
  const scale = 1 - (1 - progress) * 40 / width;
  const visibleHeight = 52 + (height - 52) * progress;
  const radius = 26 * (1 - progress);
  const transition = motion.phase === 'settling' && !reduceMotion ? 'transform 280ms cubic-bezier(.2,.75,.22,1), clip-path 280ms cubic-bezier(.2,.75,.22,1), border-radius 280ms' : 'none';
  const artwork = getPlayerArtworkLayout(width, height, insets.top, insets.bottom);
  const artSize = 34 + (artwork.size - 34) * progress;
  const artLeft = 34 + (artwork.x - 34) * progress;
  const artTop = 9 + (artwork.y - 9) * progress;
  return <div onPointerDownCapture={drag.onPointerDown} onClickCapture={drag.onClickCapture} onDragStart={(event) => event.preventDefault()}
    style={{ position: 'absolute', inset: 0, overflow: 'hidden', touchAction: 'auto' }}>
    <div data-testid="mobile-player-surface" style={{ position: 'absolute', inset: 0, height, overflow: 'hidden', borderRadius: radius,
      transform: `translateY(${position}px) scaleX(${scale})`, transformOrigin: 'top center',
      clipPath: `inset(0 0 ${Math.max(0, height - visibleHeight)}px 0 round ${radius}px)`, transition }}>
      <PlayerArtworkBackground active={focused} song={currentSong} />
      <div style={{ position: 'absolute', inset: 0, height, display: 'flex', opacity: moving ? Math.max(0, Math.min(1, (progress - 0.07) * 2)) : 1,
        transform: `scaleX(${1 / scale})`, transition: motion.phase === 'settling' && !reduceMotion ? 'opacity 280ms, transform 280ms' : 'none' }}>
        <PlayerContent artworkHidden={morphing} onClose={close} playerPresentation="modal"
          onOpenArtist={(id) => { router.dismiss(); router.push(artistHref(id)); }} />
      </div>
      {morphing && currentSong ? <>
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: Math.max(0, 1 - progress * 8), pointerEvents: 'none' }}>
          <MiniPlayer disabled onExpand={() => {}} onBeginExpand={() => {}} onExpandDrag={() => {}} onExpandRelease={() => {}} />
        </div>
        <div aria-hidden style={{ position: 'absolute', left: artLeft, top: artTop, width: artSize, height: artSize,
          borderRadius: 8 + progress * 20, overflow: 'hidden', transform: `scaleX(${1 / scale})`, transformOrigin: 'left center', pointerEvents: 'none',
          transition: motion.phase === 'settling' && !reduceMotion ? 'left 280ms cubic-bezier(.2,.75,.22,1), top 280ms cubic-bezier(.2,.75,.22,1), width 280ms cubic-bezier(.2,.75,.22,1), height 280ms cubic-bezier(.2,.75,.22,1), border-radius 280ms, transform 280ms' : 'none' }}>
          <ArtworkImage artwork={currentSong.artwork} source={currentSong.image || currentSong.imageSmall || require('@/assets/images/home/default-song.webp')} contentFit="cover" style={{ width: '100%', height: '100%' }} />
        </div>
      </> : null}
    </div>
  </div>;
}
