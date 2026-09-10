/** The expanded row moves with the content; the compact title enters continuously. */
export function compactHeaderProgress(offset: number) {
  'worklet';
  return Math.max(0, Math.min(1, (offset - 32) / 36));
}

export function expandedHeaderOpacity(offset: number) {
  'worklet';
  return 1 - Math.max(0, Math.min(1, (offset - 20) / 32));
}
