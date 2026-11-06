export function normalizePlaybackSpeed(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0.5, Math.min(2, Math.round(value * 20) / 20)) : 1;
}

export const PLAYBACK_SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export function playbackSpeedLabel(value: number): string {
  return `${Number(value.toFixed(2))}×`;
}
