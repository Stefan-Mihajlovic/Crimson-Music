import { useEffect, useLayoutEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

type DragEnd = { distance: number; velocity: number; cancelled: boolean };
type Options = {
  axis: 'x' | 'y';
  direction?: 'both' | 'positive' | 'negative';
  canStart?: (target: Element) => boolean;
  onStart?: () => void;
  onMove: (distance: number) => void;
  onEnd: (event: DragEnd) => void;
};

/** Window listeners survive the mini player's route handoff during a touch. */
export function useWebPointerDrag(options: Options) {
  const callbacks = useRef(options);
  const cleanup = useRef<(() => void) | null>(null);
  const suppressClickUntil = useRef(0);
  useLayoutEffect(() => { callbacks.current = options; }, [options]);
  useEffect(() => () => cleanup.current?.(), []);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (cleanup.current || event.button !== 0 || event.isPrimary === false) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || callbacks.current.canStart?.(target) === false) return;
    const axis = callbacks.current.axis;
    const origin = axis === 'x' ? event.clientX : event.clientY;
    const crossOrigin = axis === 'x' ? event.clientY : event.clientX;
    const pointerId = event.pointerId;
    let started = false;
    let distance = 0;
    let previous = origin;
    let previousTime = event.timeStamp;
    let velocity = 0;
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      cleanup.current = null;
    };
    const finish = (cancelled: boolean, timestamp: number) => {
      stop();
      if (!started) return;
      suppressClickUntil.current = Date.now() + 450;
      callbacks.current.onEnd({ distance, velocity: timestamp - previousTime > 120 ? 0 : velocity, cancelled });
    };
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      const point = axis === 'x' ? pointer.clientX : pointer.clientY;
      const cross = (axis === 'x' ? pointer.clientY : pointer.clientX) - crossOrigin;
      distance = point - origin;
      if (!started) {
        if (Math.abs(cross) > 8 && Math.abs(cross) > Math.abs(distance) * 1.1) { stop(); return; }
        if (Math.abs(distance) < 7 || Math.abs(distance) <= Math.abs(cross) * 1.1) return;
        const direction = callbacks.current.direction;
        if ((direction === 'positive' && distance < 0) || (direction === 'negative' && distance > 0)) { stop(); return; }
        started = true;
        callbacks.current.onStart?.();
      }
      pointer.preventDefault();
      velocity = Math.max(-3, Math.min(3, (point - previous) / Math.max(1, pointer.timeStamp - previousTime)));
      previous = point;
      previousTime = pointer.timeStamp;
      callbacks.current.onMove(distance);
    };
    const release = (pointer: PointerEvent) => { if (pointer.pointerId === pointerId) finish(false, pointer.timeStamp); };
    const cancel = () => finish(true, Number.POSITIVE_INFINITY);
    cleanup.current = stop;
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
  };
  const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
  };
  return { onPointerDown, onClickCapture };
}
