import { useRef, type PropsWithChildren } from 'react';
import { SymbolView } from '@/components/app-symbol';
import { useAppSettings } from '@/providers/settings-provider';
import { useWebPointerDrag } from '@/hooks/use-web-pointer-drag';

export default function QueueSwipeRow({ children, enabled, onRemove }: PropsWithChildren<{ enabled: boolean; onRemove: () => void }>) {
  const { colors, reduceMotion, performanceMode } = useAppSettings();
  const row = useRef<HTMLDivElement>(null);
  const paint = (offset: number, animate: boolean) => {
    if (!row.current) return;
    row.current.style.transition = animate && !reduceMotion && !performanceMode ? 'transform 180ms ease-out' : 'none';
    row.current.style.transform = `translateX(${offset}px)`;
  };
  const drag = useWebPointerDrag({
    axis: 'x', direction: 'negative', canStart: () => enabled,
    onMove: (distance) => paint(Math.max(-100, Math.min(0, distance)), false),
    onEnd: ({ distance, cancelled }) => { paint(0, true); if (!cancelled && distance < -72 && enabled) onRemove(); },
  });
  return <div style={{ position: 'relative', overflow: 'hidden', touchAction: 'pan-y' }} onPointerDown={drag.onPointerDown} onClickCapture={drag.onClickCapture}>
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: '#B33250', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 28 }}><SymbolView name="trash" size={22} tintColor="#FFFFFF" /></div>
    <div ref={row} style={{ background: colors.elevated }}>{children}</div>
  </div>;
}
