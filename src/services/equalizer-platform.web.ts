import type { AudioPlayer } from 'expo-audio';
import type { EqualizerSettings } from './equalizer';
import { configureWebEqualizer } from './web-deck-gain';

export function applyEqualizer(players: readonly AudioPlayer[], settings: EqualizerSettings): boolean {
  return configureWebEqualizer(players, settings);
}
