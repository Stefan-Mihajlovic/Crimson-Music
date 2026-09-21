#ifndef CRIMSON_LOUDNESS_DSP_H
#define CRIMSON_LOUDNESS_DSP_H
#include <math.h>
#include <stdbool.h>
#include <string.h>
// Streaming RMS normalization: linked channels, silence gate, bounded boost,
// slow gain recovery, and a final linked peak ceiling. No render allocations.
typedef struct {
  double energy, weight, gain, energyAlpha, attackAlpha, releaseAlpha;
} CrimsonLoudnessDSP;
static inline void crimson_loudness_reset(CrimsonLoudnessDSP *dsp, double rate) {
  memset(dsp, 0, sizeof(*dsp));
  rate = isfinite(rate) && rate > 0 ? rate : 48000;
  dsp->gain = 1;
  dsp->energyAlpha = exp(-1.0 / (rate * 3.0));
  dsp->attackAlpha = exp(-1.0 / (rate * 0.15));
  dsp->releaseAlpha = exp(-1.0 / (rate * 3.0));
}
static inline void crimson_loudness_frame(CrimsonLoudnessDSP *dsp, double *samples, int channels, bool enabled) {
  if (channels <= 0) return;
  double energy = 0, peak = 0;
  for (int c = 0; c < channels; c++) {
    if (!isfinite(samples[c])) samples[c] = 0;
    energy += samples[c] * samples[c];
    peak = fmax(peak, fabs(samples[c]));
  }
  energy /= channels;
  dsp->weight = dsp->energyAlpha * dsp->weight + (1 - dsp->energyAlpha);
  dsp->energy = dsp->energyAlpha * dsp->energy + (1 - dsp->energyAlpha) * energy;
  // Correct the initial estimator bias without boosting the beginning of silence.
  double mean = dsp->energy / fmax(1e-12, dsp->weight);
  double target = 1;
  if (enabled) target = mean > 1e-6 ? fmax(0.1, fmin(2.0, 0.125 / sqrt(mean))) : fmin(1, dsp->gain);
  double alpha = target < dsp->gain ? dsp->attackAlpha : dsp->releaseAlpha;
  dsp->gain = target + (dsp->gain - target) * alpha;
  double gain = (enabled || fabs(dsp->gain - 1) > 0.00001) && peak > 0 ? fmin(dsp->gain, 0.98 / peak) : dsp->gain;
  for (int c = 0; c < channels; c++) samples[c] *= gain;
}
#endif
