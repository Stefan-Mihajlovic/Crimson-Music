export type FoldingFeature = { orientation: 'vertical' | 'horizontal'; x: number; y: number; width: number; height: number };
export type Pane = { x: number; y: number; width: number; height: number };
type Insets = { left: number; right: number; top: number; bottom: number };
/** Window points, never screen pixels or a guessed device model. */
export function playerPanes(width: number, height: number, insets: Insets, fold?: FoldingFeature | null) {
  const left = Math.max(22, insets.left + 12);
  const right = width - Math.max(22, insets.right + 12);
  const top = Math.max(18, insets.top) + 52;
  const bottom = height - Math.max(18, insets.bottom);
  const area: Pane = { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  const validFold = fold && [fold.x, fold.y, fold.width, fold.height].every(Number.isFinite) && fold.width >= 0 && fold.height >= 0;
  if (validFold && fold.orientation === 'horizontal' && fold.y > top + 120 && fold.y + fold.height < bottom - 160) {
    return { mode: 'tabletop' as const,
      artwork: { ...area, height: fold.y - 16 - top },
      controls: { ...area, y: fold.y + fold.height + 16, height: bottom - fold.y - fold.height - 16 },
    };
  }
  if (validFold && fold.orientation === 'vertical' && fold.x > left + 160 && fold.x + fold.width < right - 240) {
    return { mode: 'book' as const,
      artwork: { ...area, width: fold.x - 16 - left },
      controls: { ...area, x: fold.x + fold.width + 16, width: right - fold.x - fold.width - 16 },
    };
  }
  if (area.width >= 650 || (width > height && area.width >= 520)) {
    const paneWidth = (area.width - 32) / 2;
    return { mode: 'wide' as const, artwork: { ...area, width: paneWidth }, controls: { ...area, x: left + paneWidth + 32, width: paneWidth } };
  }
  return { mode: 'compact' as const, artwork: area, controls: area };
}
