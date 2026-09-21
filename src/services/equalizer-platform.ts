import type { AudioPlayer } from 'expo-audio';
import { normalizeEqualizer, type EqualizerSettings } from './equalizer';
import { equalizerPreampDb } from './equalizer-dsp';

type EqualizerPlayer = { setCrimsonEqualizer?: (enabled: boolean, bands: number[], preampDb: number) => boolean };

/** Apply to both persistent decks, including when disabled, before the first source is loaded. */
export function applyEqualizer(players: readonly AudioPlayer[], settings: EqualizerSettings): boolean {
  const normalized = normalizeEqualizer(settings);
  const preamp = normalized.enabled ? equalizerPreampDb(normalized.bands) : 0;
  let supported = players.length > 0;
  for (const player of new Set(players)) {
    const native = player as unknown as EqualizerPlayer;
    try {
      if (!native.setCrimsonEqualizer || native.setCrimsonEqualizer(normalized.enabled, normalized.bands, preamp) === false) supported = false;
    } catch { supported = false; }
  }
  return supported;
}
