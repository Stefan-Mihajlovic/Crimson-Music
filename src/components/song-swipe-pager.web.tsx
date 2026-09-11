import ArtworkImage from '@/components/artwork-image';
import { useEffect, useRef, useState } from 'react';

import { useWebPointerDrag } from '@/hooks/use-web-pointer-drag';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';

function useSongSwipe(pageWidth: number, enabled: boolean) {
  const { currentSong, nextSong, previousSong, playNext, playPrevious } = usePlayer();
  const { reduceMotion } = useAppSettings();
  const [movement, setMovement] = useState({ id: '', offset: 0, settling: false });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const songId = currentSong?.id || '';
  const reset = () => setMovement({ id: songId, offset: 0, settling: true });
  const drag = useWebPointerDrag({
    axis: 'x', canStart: () => enabled,
    onStart: () => clearTimeout(timer.current),
    onMove: (distance) => setMovement({ id: songId, offset: Math.max(-pageWidth, Math.min(pageWidth, distance * ((distance > 0 ? previousSong : nextSong) ? 1 : 0.15))), settling: false }),
    onEnd: ({ distance, velocity, cancelled }) => {
      const forward = distance < 0;
      if (cancelled || !(forward ? nextSong : previousSong) || (Math.abs(distance) < pageWidth * 0.2 && Math.abs(velocity) < 0.5)) { reset(); return; }
      setMovement({ id: songId, offset: forward ? -pageWidth : pageWidth, settling: true });
      const finish = () => { if (forward) playNext(); else playPrevious(); setMovement({ id: '', offset: 0, settling: false }); };
      if (reduceMotion) finish(); else timer.current = setTimeout(finish, 180);
    },
  });
  return {
    drag,
    offset: movement.id === songId ? movement.offset : 0,
    transition: movement.id === songId && movement.settling && !reduceMotion ? 'transform 180ms cubic-bezier(.18,.76,.22,1)' : 'none',
    songs: [previousSong, currentSong, nextSong],
  };
}

export function SwipeableArtwork({ borderRadius = 28, enabled = true, pageGap = 30, size }: { borderRadius?: number; enabled?: boolean; pageGap?: number; size: number }) {
  const { dataSaver } = useAppSettings();
  const pageWidth = size + pageGap;
  const { drag, offset, transition, songs } = useSongSwipe(pageWidth, enabled);
  return <div data-testid="web-artwork-swipe" onPointerDown={drag.onPointerDown} onClickCapture={drag.onClickCapture} onDragStart={(event) => event.preventDefault()}
    style={{ width: size, height: size, overflow: 'visible', touchAction: 'none', userSelect: 'none' }}>
    <div style={{ display: 'flex', width: pageWidth * 3, height: size, transform: `translateX(${-pageWidth + offset}px)`, transition }}>
      {songs.map((song, index) => <div key={index} style={{ width: pageWidth, height: size, flexShrink: 0 }}>
        <div style={{ width: size, height: size, borderRadius, overflow: 'hidden', background: '#211C28' }}>
          {song ? <ArtworkImage artwork={song.artwork} source={(dataSaver ? song.imageSmall : song.image) || song.imageSmall || require('@/assets/images/home/default-song.webp')} contentFit="cover" style={{ width: size, height: size }} /> : null}
        </div>
      </div>)}
    </div>
  </div>;
}

export function SwipeableSongCopy({ enabled = true, leadingInset = 0 }: { enabled?: boolean; leadingInset?: number }) {
  const { colors } = useAppSettings();
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(220);
  useEffect(() => {
    if (!frame.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  const { drag, offset, transition, songs } = useSongSwipe(width, enabled);
  return <div ref={frame} onPointerDown={drag.onPointerDown} onClickCapture={drag.onClickCapture} style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', touchAction: 'none' }}>
    <div style={{ display: 'flex', width: width * 3, height: '100%', transform: `translateX(${-width + offset}px)`, transition }}>
      {songs.map((song, index) => <div key={index} style={{ flexShrink: 0, width, minWidth: 0, height: '100%', paddingLeft: leadingInset, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{ color: colors.text, fontSize: 15, fontWeight: 700, letterSpacing: '-.2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{song?.title}</span>
        <span style={{ color: colors.secondaryText, fontSize: 12, marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{song?.creator}</span>
      </div>)}
    </div>
  </div>;
}
