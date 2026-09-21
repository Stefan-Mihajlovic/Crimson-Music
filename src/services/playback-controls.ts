export function normalizePlaybackSpeed(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0.5, Math.min(2, Math.round(value * 20) / 20)) : 1;
}
