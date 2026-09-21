import type { AudioPlayer } from 'expo-audio';
import { configureWebSleepTimer } from '@/services/web-deck-gain';

export function setNativeSleepDeadline(players: readonly AudioPlayer[], deadlineAt: number): boolean {
  try { return configureWebSleepTimer(players, deadlineAt); }
  catch { return false; }
}
export function nativeSleepExpired(_players: readonly AudioPlayer[], _deadlineAt: number): boolean { return false; }
