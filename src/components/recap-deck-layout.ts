/** The opening card follows the page gutter; later cards snap to the center. */
export function recapDeckLayout(viewportWidth: number, slideCount: number) {
  const cardWidth = Math.min(viewportWidth - 80, 360);
  const gap = 12;
  const pageWidth = cardWidth + gap;
  const leadingInset = 20;
  const trailingInset = (viewportWidth - cardWidth) / 2;
  const firstCenterOffset = leadingInset - trailingInset;
  // On wide screens, leave enough space after the opening card for a forward
  // swipe to center the second card without duplicate or negative snap offsets.
  const firstGapExtra = Math.max(0, -firstCenterOffset - pageWidth / 2);
  const snapOffsets = Array.from({ length: slideCount }, (_, index) => (
    index === 0 ? 0 : index * pageWidth + firstGapExtra + firstCenterOffset
  ));
  return { cardWidth, gap, leadingInset, trailingInset, firstCenterOffset, firstGapExtra, snapOffsets };
}
