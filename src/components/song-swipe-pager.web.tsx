import { songSwipeDirection } from '@/services/song-swipe';
import ArtworkImage from '@/components/artwork-image';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useWebPointerDrag } from '@/hooks/use-web-pointer-drag';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';

function useSongSwipe(pageWidth: number, enabled: boolean) {
  const { currentSong, nextSong, previousSong, queueIndex, playNext, playPrevious } = usePlayer();
  const { reduceMotion, performanceMode } = useAppSettings();
  const track = useRef<HTMLDivElement>(null);
  const settling = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const key = `${currentSong?.id || ''}:${queueIndex}`;
  const latest = useRef(key);
  const motionOff = reduceMotion || performanceMode;
  const paint = (offset: number, animate: boolean) => {
    if (!track.current) return;
    track.current.style.transition = animate && !motionOff ? 'transform 210ms cubic-bezier(.18,.76,.22,1)' : 'none';
    track.current.style.transform = `translateX(${-pageWidth + offset}px)`;
  };
  useLayoutEffect(() => {
    latest.current = key;
    clearTimeout(timer.current);
    settling.current = false;
    if (track.current) { track.current.style.transition = 'none'; track.current.style.transform = `translateX(${-pageWidth}px)`; }
    return () => clearTimeout(timer.current);
  }, [key, pageWidth, enabled]);
  const select = (direction: number) => {
    if (settling.current || !enabled || !(direction < 0 ? nextSong : previousSong)) return;
    settling.current = true;
    paint(direction * pageWidth, true);
    const finish = () => {
      if (latest.current !== key) return;
      if (direction < 0) playNext(); else playPrevious();
      settling.current = false;
      paint(0, false);
    };
    if (motionOff) finish(); else timer.current = setTimeout(finish, 210);
  };
  const drag = useWebPointerDrag({
    axis: 'x', canStart: () => enabled && !settling.current,
    onMove: (distance) => paint(Math.max(-pageWidth, Math.min(pageWidth, distance * ((distance > 0 ? previousSong : nextSong) ? 1 : 0.14))), false),
    onEnd: ({ distance, velocity, cancelled }) => {
      const direction = cancelled ? 0 : songSwipeDirection(distance, velocity * 1000, pageWidth, Boolean(previousSong), Boolean(nextSong));
      if (direction) select(direction); else paint(0, true);
    },
  });
  return { drag, track, songs: [previousSong, currentSong, nextSong], select };
}

export function SwipeableArtwork({ borderRadius = 28, enabled = true, pageGap = 30, size }: { borderRadius?: number; enabled?: boolean; pageGap?: number; size: number }) {
  const { dataSaver } = useAppSettings();
  const pageWidth = size + pageGap;
  const { drag, track, songs, select } = useSongSwipe(pageWidth, enabled);
  return <div data-testid="web-artwork-swipe" role="group" aria-label="Album artwork. Use left and right arrows to change songs." tabIndex={enabled ? 0 : -1}
    onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); select(event.key === 'ArrowLeft' ? 1 : -1); } }} onPointerDown={drag.onPointerDown} onClickCapture={drag.onClickCapture} onDragStart={(event) => event.preventDefault()}
    style={{ width: size, height: size, overflow: 'visible', touchAction: 'none', userSelect: 'none' }}>
    <div ref={track} style={{ display: 'flex', width: pageWidth * 3, height: size, transform: `translateX(${-pageWidth}px)` }}>
      {songs.map((song, index) => <div key={index} aria-hidden={index !== 1} style={{ width: pageWidth, height: size, flexShrink: 0 }}>
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
  const { drag, track, songs } = useSongSwipe(width, enabled);
  return <div ref={frame} onPointerDown={drag.onPointerDown} onClickCapture={drag.onClickCapture} style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', touchAction: 'none' }}>
    <div ref={track} style={{ display: 'flex', width: width * 3, height: '100%', transform: `translateX(${-width}px)` }}>
      {songs.map((song, index) => <div key={index} aria-hidden={index !== 1} style={{ flexShrink: 0, width, minWidth: 0, height: '100%', paddingLeft: leadingInset, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span style={{ color: colors.text, fontSize: 15, fontWeight: 700, letterSpacing: '-.2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{song?.title}</span>
        <span style={{ color: colors.secondaryText, fontSize: 12, marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{song?.creator}</span>
      </div>)}
    </div>
  </div>;
}
