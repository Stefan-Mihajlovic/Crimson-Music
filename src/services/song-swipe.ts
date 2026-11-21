/** Velocity is expressed in points/second on both native and web. */
export function songSwipeDirection(distance: number, velocity: number, width: number, previous: boolean, next: boolean): -1 | 0 | 1 {
  'worklet';
  if (width <= 0 || !Number.isFinite(distance) || !Number.isFinite(velocity)) return 0;
  // A last-moment reversal cancels the skip instead of committing the old direction.
  if (distance * velocity < 0 && Math.abs(velocity) > 420) return 0;
  const committed = Math.abs(distance) >= width * 0.22 || (Math.abs(distance) >= 12 && Math.abs(velocity) >= 620);
  if (!committed) return 0;
  return distance < 0 && next ? -1 : distance > 0 && previous ? 1 : 0;
}
