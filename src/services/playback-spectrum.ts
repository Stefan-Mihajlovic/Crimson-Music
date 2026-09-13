export const PAUSED_SPECTRUM = [0.36, 0.36, 0.36, 0.36];
export const SPECTRUM_UPDATE_INTERVAL_MS = 50;

type Sample = { channels: { frames: readonly number[] }[] };
const MAX_FRAMES = 512;
const MIN_LEVEL = 0.06;
const NOISE_FLOOR = 0.003;
const bandWeights = [1, 1.1, 1.4, 1.7];

// Expo supplies PCM without its sample rate. These broad, increasing frequency
// bands therefore follow the source rate rather than claiming exact Hz labels.
const transforms = new Map<number, { window: Float64Array; reverse: Uint16Array; cos: Float64Array; sin: Float64Array }>();
for (const size of [32, 64, 128, 256, MAX_FRAMES]) {
  const window = new Float64Array(size);
  const reverse = new Uint16Array(size);
  const cos = new Float64Array(size / 2);
  const sin = new Float64Array(size / 2);
  const bits = Math.log2(size);
  for (let index = 0; index < size; index += 1) {
    window[index] = 0.5 * (1 - Math.cos(2 * Math.PI * index / size));
    let source = index;
    for (let bit = 0; bit < bits; bit += 1) {
      reverse[index] = (reverse[index] << 1) | (source & 1);
      source >>= 1;
    }
    if (index < size / 2) {
      cos[index] = Math.cos(-2 * Math.PI * index / size);
      sin[index] = Math.sin(-2 * Math.PI * index / size);
    }
  }
  transforms.set(size, { window, reverse, cos, sin });
}

/** One bounded FFT per stereo channel, shared by every visible playback marker. */
export class PlaybackSpectrumAnalyzer {
  private real = new Float64Array(MAX_FRAMES);
  private imaginary = new Float64Array(MAX_FRAMES);
  private envelope = 0.08;
  private levels = [...PAUSED_SPECTRUM];

  reset() {
    this.envelope = 0.08;
    this.levels = [...PAUSED_SPECTRUM];
  }

  analyze(sample: Sample, elapsedMs = SPECTRUM_UPDATE_INTERVAL_MS): number[] | null {
    const channels = sample.channels.filter((channel) => channel.frames.length >= 32).slice(0, 2);
    if (!channels.length) return null;
    const available = Math.min(MAX_FRAMES, ...channels.map((channel) => channel.frames.length));
    const size = 2 ** Math.floor(Math.log2(available));
    const { window, reverse, cos, sin } = transforms.get(size)!;
    const energy = [0, 0, 0, 0];
    const { real, imaginary } = this;

    for (const channel of channels) {
      const offset = channel.frames.length - size;
      let mean = 0;
      for (let index = 0; index < size; index += 1) {
        const value = channel.frames[offset + index];
        mean += Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
      }
      mean /= size;
      for (let index = 0; index < size; index += 1) {
        const value = channel.frames[offset + index];
        const pcm = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
        real[reverse[index]] = (pcm - mean) * window[index];
        imaginary[index] = 0;
      }
      for (let length = 2; length <= size; length *= 2) {
        const half = length / 2;
        const stride = size / length;
        for (let start = 0; start < size; start += length) {
          for (let index = 0; index < half; index += 1) {
            const even = start + index;
            const odd = even + half;
            const twiddle = index * stride;
            const transformedReal = real[odd] * cos[twiddle] - imaginary[odd] * sin[twiddle];
            const transformedImaginary = real[odd] * sin[twiddle] + imaginary[odd] * cos[twiddle];
            real[odd] = real[even] - transformedReal;
            imaginary[odd] = imaginary[even] - transformedImaginary;
            real[even] += transformedReal;
            imaginary[even] += transformedImaginary;
          }
        }
      }
      for (let bin = 1; bin <= size / 2; bin += 1) {
        const band = bin < size / 128 ? 0 : bin < size / 32 ? 1 : bin < size / 8 ? 2 : 3;
        energy[band] += real[bin] ** 2 + imaginary[bin] ** 2;
      }
    }

    // Sum channel energy instead of mixing PCM, so opposite-phase stereo stays audible.
    const amplitudes = energy.map((value, index) => Math.sqrt(value * 2 / channels.length) / (size * Math.sqrt(0.375)) * bandWeights[index]);
    const dt = Math.max(1, Math.min(250, Number.isFinite(elapsedMs) ? elapsedMs : SPECTRUM_UPDATE_INTERVAL_MS));
    const peak = Math.max(...amplitudes);
    // A single, slowly falling reference preserves differences between instruments;
    // independent per-bar auto-gain would make quiet treble as tall as a bass hit.
    this.envelope = Math.max(0.08, peak, this.envelope * Math.exp(-dt / 1800));
    this.levels = amplitudes.map((amplitude, index) => {
      const relative = Math.max(0, amplitude - NOISE_FLOOR) / (this.envelope * 1.05);
      const target = MIN_LEVEL + (1 - MIN_LEVEL) * Math.min(1, relative ** 0.85);
      const timeConstant = target > this.levels[index] ? 15 : 95;
      const next = target + (this.levels[index] - target) * Math.exp(-dt / timeConstant);
      return Math.abs(next - target) < 0.001 ? target : next;
    });
    return this.levels;
  }
}
