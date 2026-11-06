export const IDLE_VISUALIZER_FRAME = Array<number>(20).fill(0);

/** Keep quiet instruments visible without turning a sustained note into a fake
 * beat. The last slot is the measured rise in low-frequency energy. */
export class VisualizerResponse {
  private previousBass = 0;
  private kick = 0;

  next(levels: readonly number[]): number[] {
    const bands = Array.from({ length: 16 }, (_, index) => {
      const value = levels[index];
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    });
    const region = (start: number, end: number) => {
      let energy = 0, peak = 0;
      for (let i = start; i < end; i++) {
        energy += bands[i] * bands[i];
        peak = Math.max(peak, bands[i]);
      }
      return Math.min(1, (0.65 * Math.sqrt(energy / (end - start)) + 0.35 * peak) ** 0.7 * 1.2);
    };
    const bass = region(0, 6), mids = region(6, 11), treble = region(11, 16);
    this.kick = Math.max(Math.min(1, Math.max(0, bass - this.previousBass) * 1.6), this.kick * 0.55);
    this.previousBass = bass;
    if (!bands.some(Boolean)) this.kick = 0;
    return [...bands, bass, mids, treble, this.kick];
  }
}
