export const EQUALIZER_FREQUENCIES = [100, 300, 1000, 4000, 10000] as const;
export const EQUALIZER_FILTER_TYPES = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'] as const;
export const EQUALIZER_PRESETS = [
  { id: 'flat', name: 'Flat', description: 'An even balance across all frequencies.', bands: [0, 0, 0, 0, 0] },
  { id: 'bass', name: 'Bass boost', description: 'More weight in bass lines and kick drums.', bands: [7, 3, -1, 0, 0] },
  { id: 'treble', name: 'Treble boost', description: 'Brighter detail in cymbals and high notes.', bands: [0, -1, 0, 2, 5] },
  { id: 'vocal', name: 'Vocal', description: 'Bring voices and spoken words forward.', bands: [-2, -2, 2, 3, -1] },
  { id: 'rock', name: 'Rock', description: 'Fuller drums with a little more guitar presence.', bands: [4, 1, -1, 2, 3] },
  { id: 'electronic', name: 'Electronic', description: 'Deep lows and crisp synths.', bands: [6, 2, -2, 1, 4] },
  { id: 'acoustic', name: 'Acoustic', description: 'Warm instruments with clear upper detail.', bands: [-1, 1, 2, 1, 2] },
  { id: 'classical', name: 'Classical', description: 'A gentle lift at the low and high ends.', bands: [2, 0, -1, 1, 2] },
] as const;
export type EqualizerPresetId = typeof EQUALIZER_PRESETS[number]['id'] | 'custom';
export type EqualizerSettings = { enabled: boolean; preset: EqualizerPresetId; bands: number[] };
export const DEFAULT_EQUALIZER: EqualizerSettings = { enabled: false, preset: 'flat', bands: [0, 0, 0, 0, 0] };

// Only upgrade exact saved factory curves; keep the listener's custom gains.
const previousPresetBands: Partial<Record<EqualizerPresetId, readonly number[]>> = {
  bass: [6, 4, 0, -1, 0], treble: [-1, 0, 0, 3, 5], vocal: [-3, -1, 3, 4, 0],
  rock: [4, 2, -2, 3, 4], electronic: [5, 3, -2, 2, 4], acoustic: [2, 1, 2, 2, 3], classical: [3, 1, -1, 1, 3],
};

export function normalizeEqualizer(value: unknown): EqualizerSettings {
  const input = value as Partial<EqualizerSettings> | null;
  const preset = EQUALIZER_PRESETS.find((item) => item.id === input?.preset);
  if (!input || !Array.isArray(input.bands) || input.bands.length !== 5) {
    return { enabled: input?.enabled === true, preset: preset?.id ?? 'flat', bands: [...(preset?.bands ?? DEFAULT_EQUALIZER.bands)] };
  }
  const previous = preset && previousPresetBands[preset.id];
  if (previous?.every((gain, index) => gain === input.bands![index])) {
    return { enabled: input.enabled === true, preset: preset!.id, bands: [...preset!.bands] };
  }
  const bands = input.bands.map((gain) => typeof gain === 'number' && Number.isFinite(gain) ? Math.round(Math.max(-12, Math.min(12, gain))) : 0);
  const matching = EQUALIZER_PRESETS.find((item) => item.bands.every((gain, index) => gain === bands[index]));
  return { enabled: input.enabled === true, preset: matching?.id ?? 'custom', bands };
}

export function equalizerPresetName(value: EqualizerSettings) {
  return EQUALIZER_PRESETS.find((preset) => preset.id === value.preset)?.name ?? 'Custom';
}
