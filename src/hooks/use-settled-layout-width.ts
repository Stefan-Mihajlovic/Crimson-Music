import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

// Carousels need a numeric size for their generated artwork. Wait for a resize
// to settle instead of rebuilding that artwork and Home on every pointer frame.
export function useSettledLayoutWidth() {
  const [width, setWidth] = useState(0);
  const measured = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (next <= 0) return;
    clearTimeout(timer.current);
    if (!measured.current) {
      measured.current = true;
      setWidth(next);
    } else {
      timer.current = setTimeout(() => setWidth(next), 120);
    }
  }, []);
  return [width, onLayout] as const;
}
