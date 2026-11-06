export const VISUALIZER_STYLES = [
  { id: 'aurora', name: 'Aurora', description: 'Soft ribbons of color that swell with the music.' },
  { id: 'spectrum', name: 'Spectrum', description: 'A luminous spectrum from bass to treble.' },
  { id: 'orbit', name: 'Orbit', description: 'Light rings pulsing around your album artwork.' },
  { id: 'tides', name: 'Tides', description: 'Layers of luminous waves lifted by every note.' },
  { id: 'prism', name: 'Prism', description: 'Fans of light that open with the beat.' },
] as const;

export type VisualizerArtworkLayout = { x: number; y: number; size: number };
export type VisualizerStyle = typeof VISUALIZER_STYLES[number]['id'];
export function normalizeVisualizerStyle(value: unknown): VisualizerStyle {
  return VISUALIZER_STYLES.find((style) => style.id === value)?.id ?? 'aurora';
}
