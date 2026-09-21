import { EQUALIZER_FREQUENCIES, EQUALIZER_FILTER_TYPES } from './equalizer';

export const EQUALIZER_Q = Math.SQRT1_2;
export const EQUALIZER_RAMP_SECONDS = 0.025;

/** RBJ filters, shared with native DSP and Web Audio. Shelves use slope S = 1. */
export function equalizerCoefficients(frequency: number, gain: number, sampleRate: number, type: 'peaking' | 'lowshelf' | 'highshelf' = 'peaking') {
  const omega = 2 * Math.PI * Math.min(frequency, sampleRate * 0.45) / sampleRate;
  const amplitude = 10 ** (gain / 40);
  const alpha = Math.sin(omega) / (2 * EQUALIZER_Q);
  const cosine = Math.cos(omega);
  if (type !== 'peaking') {
    const a = amplitude;
    const beta = 2 * Math.sqrt(a) * Math.sin(omega) / Math.SQRT2;
    if (type === 'lowshelf') {
      const a0 = (a + 1) + (a - 1) * cosine + beta;
      return [a * ((a + 1) - (a - 1) * cosine + beta) / a0,
        2 * a * ((a - 1) - (a + 1) * cosine) / a0,
        a * ((a + 1) - (a - 1) * cosine - beta) / a0,
        -2 * ((a - 1) + (a + 1) * cosine) / a0,
        ((a + 1) + (a - 1) * cosine - beta) / a0];
    }
    const a0 = (a + 1) - (a - 1) * cosine + beta;
    return [a * ((a + 1) + (a - 1) * cosine + beta) / a0,
      -2 * a * ((a - 1) + (a + 1) * cosine) / a0,
      a * ((a + 1) + (a - 1) * cosine - beta) / a0,
      2 * ((a - 1) - (a + 1) * cosine) / a0,
      ((a + 1) - (a - 1) * cosine - beta) / a0];
  }
  const a0 = 1 + alpha / amplitude;
  return [(1 + alpha * amplitude) / a0, -2 * Math.cos(omega) / a0,
    (1 - alpha * amplitude) / a0, -2 * Math.cos(omega) / a0, (1 - alpha / amplitude) / a0];
}

export function equalizerResponseDb(bands: readonly number[], frequency: number, sampleRate = 48000) {
  const omega = 2 * Math.PI * frequency / sampleRate;
  return bands.reduce((db, gain, index) => {
    const [b0, b1, b2, a1, a2] = equalizerCoefficients(EQUALIZER_FREQUENCIES[index], gain, sampleRate, EQUALIZER_FILTER_TYPES[index]);
    const numerator = (b0 + b1 * Math.cos(omega) + b2 * Math.cos(2 * omega)) ** 2
      + (b1 * Math.sin(omega) + b2 * Math.sin(2 * omega)) ** 2;
    const denominator = (1 + a1 * Math.cos(omega) + a2 * Math.cos(2 * omega)) ** 2
      + (a1 * Math.sin(omega) + a2 * Math.sin(2 * omega)) ** 2;
    return db + 10 * Math.log10(Math.max(1e-20, numerator / denominator));
  }, 0);
}

/** Leave a little headroom; the linked limiter handles actual peaks instead of muting the whole track. */
export function equalizerPreampDb(bands: readonly number[]) {
  const boost = Math.max(0, ...bands.map((gain) => Number.isFinite(gain) ? gain : 0));
  return boost ? -Math.min(2, boost / 5) : 0;
}

/** Conservative fallback for web contexts where the render-thread limiter is unavailable. */
export function equalizerSafePreampDb(bands: readonly number[], sampleRate?: number) {
  if (!bands.some((gain) => gain > 0)) return 0;
  let peak = 0;
  for (const rate of sampleRate ? [sampleRate] : [22050, 32000, 44100, 48000, 96000, 192000]) {
    for (let step = 0; step <= 512; step++) {
      const frequency = 10 * (rate / 20) ** (step / 512);
      peak = Math.max(peak, equalizerResponseDb(bands, frequency, rate));
    }
  }
  return -Math.ceil((peak + 1) * 10) / 10;
}
