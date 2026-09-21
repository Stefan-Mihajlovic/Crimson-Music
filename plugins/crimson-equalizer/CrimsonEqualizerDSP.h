#ifndef CRIMSON_EQUALIZER_DSP_H
#define CRIMSON_EQUALIZER_DSP_H

#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

// RBJ shelves (S=1) and peaking filters (Q=sqrt(0.5)):
// https://www.w3.org/TR/audio-eq-cookbook/
// A fixed-size render state avoids allocations and locks in the audio callback.
#define CRIMSON_EQ_BANDS 5
#define CRIMSON_EQ_CHANNELS 32
#define CRIMSON_EQ_CEILING 0.98
typedef struct {
  double coefficients[5][5], target[5][5], increment[5][5];
  double memory[CRIMSON_EQ_CHANNELS][5][2];
  double sampleRate, gain, targetGain, gainIncrement;
  double limiterGain, limiterRelease;
  int limiterHold, limiterHoldFrames;
  int remaining;
  bool initialized, bypass;
} CrimsonEqualizerDSP;

static inline void crimson_eq_coefficients(int band, double frequency, double gain, double rate, double out[5]) {
  const double omega = 6.283185307179586 * fmin(frequency, rate * 0.45) / rate;
  const double amplitude = pow(10.0, gain / 40.0);
  const double alpha = sin(omega) / 1.4142135623730951;
  const double cosine = cos(omega);
  double a0;
  if (band == 0) {
    const double rootAlpha = 2.0 * sqrt(amplitude) * alpha;
    a0 = (amplitude + 1.0) + (amplitude - 1.0) * cosine + rootAlpha;
    out[0] = amplitude * ((amplitude + 1.0) - (amplitude - 1.0) * cosine + rootAlpha);
    out[1] = 2.0 * amplitude * ((amplitude - 1.0) - (amplitude + 1.0) * cosine);
    out[2] = amplitude * ((amplitude + 1.0) - (amplitude - 1.0) * cosine - rootAlpha);
    out[3] = -2.0 * ((amplitude - 1.0) + (amplitude + 1.0) * cosine);
    out[4] = (amplitude + 1.0) + (amplitude - 1.0) * cosine - rootAlpha;
  } else if (band == 4) {
    const double rootAlpha = 2.0 * sqrt(amplitude) * alpha;
    a0 = (amplitude + 1.0) - (amplitude - 1.0) * cosine + rootAlpha;
    out[0] = amplitude * ((amplitude + 1.0) + (amplitude - 1.0) * cosine + rootAlpha);
    out[1] = -2.0 * amplitude * ((amplitude - 1.0) + (amplitude + 1.0) * cosine);
    out[2] = amplitude * ((amplitude + 1.0) + (amplitude - 1.0) * cosine - rootAlpha);
    out[3] = 2.0 * ((amplitude - 1.0) - (amplitude + 1.0) * cosine);
    out[4] = (amplitude + 1.0) - (amplitude - 1.0) * cosine - rootAlpha;
  } else {
    a0 = 1.0 + alpha / amplitude;
    out[0] = 1.0 + alpha * amplitude;
    out[1] = -2.0 * cosine;
    out[2] = 1.0 - alpha * amplitude;
    out[3] = out[1];
    out[4] = 1.0 - alpha / amplitude;
  }
  for (int c = 0; c < 5; c++) out[c] /= a0;
}

static inline void crimson_eq_reset(CrimsonEqualizerDSP *dsp, double sampleRate) {
  memset(dsp, 0, sizeof(*dsp));
  dsp->sampleRate = sampleRate > 0 ? sampleRate : 48000;
  dsp->gain = dsp->targetGain = 1;
  dsp->limiterGain = 1;
  dsp->limiterRelease = exp(-1.0 / (dsp->sampleRate * 0.150));
  dsp->limiterHoldFrames = (int)ceil(dsp->sampleRate * 0.030);
}

static inline void crimson_eq_configure(CrimsonEqualizerDSP *dsp, bool enabled, const float bands[5], float preampDb) {
  static const double frequencies[5] = {100, 300, 1000, 4000, 10000};
  bool nonflat = false;
  for (int band = 0; band < 5; band++) if (isfinite(bands[band]) && fabsf(bands[band]) > 0.000001f) nonflat = true;
  const bool active = enabled && nonflat;
  dsp->bypass = !active;
  const int rampFrames = (int)ceil(dsp->sampleRate * 0.025);
  dsp->targetGain = active ? pow(10.0, fmax(-72.0, fmin(0.0, isfinite(preampDb) ? preampDb : 0)) / 20.0) : 1;
  for (int band = 0; band < 5; band++) {
    const double gain = active && isfinite(bands[band]) ? fmax(-12, fmin(12, bands[band])) : 0;
    crimson_eq_coefficients(band, frequencies[band], gain, dsp->sampleRate, dsp->target[band]);
    for (int coefficient = 0; coefficient < 5; coefficient++) {
      if (!dsp->initialized) dsp->coefficients[band][coefficient] = dsp->target[band][coefficient];
      dsp->increment[band][coefficient] = (dsp->target[band][coefficient] - dsp->coefficients[band][coefficient]) / rampFrames;
    }
  }
  if (!dsp->initialized) dsp->gain = dsp->targetGain;
  dsp->gainIncrement = (dsp->targetGain - dsp->gain) / rampFrames;
  dsp->remaining = dsp->initialized ? rampFrames : 0;
  dsp->initialized = true;
}

static inline void crimson_eq_frame(CrimsonEqualizerDSP *dsp) {
  if (!dsp->remaining) return;
  dsp->remaining--;
  dsp->gain = dsp->remaining ? dsp->gain + dsp->gainIncrement : dsp->targetGain;
  for (int band = 0; band < 5; band++) {
    for (int coefficient = 0; coefficient < 5; coefficient++) {
      dsp->coefficients[band][coefficient] = dsp->remaining
        ? dsp->coefficients[band][coefficient] + dsp->increment[band][coefficient]
        : dsp->target[band][coefficient];
    }
  }
  if (!dsp->remaining && dsp->bypass) {
    memset(dsp->memory, 0, sizeof(dsp->memory));
    dsp->limiterGain = 1;
    dsp->limiterHold = 0;
  }
}

// Process every channel first; clipping here would hide peaks from the linked limiter.
static inline double crimson_eq_sample(CrimsonEqualizerDSP *dsp, double input, int channel) {
  if (channel < 0 || channel >= CRIMSON_EQ_CHANNELS || !dsp->initialized || (dsp->bypass && !dsp->remaining)) return input;
  double value = isfinite(input) ? input * dsp->gain : 0;
  for (int band = 0; band < 5; band++) {
    const double *c = dsp->coefficients[band];
    double *state = dsp->memory[channel][band];
    const double output = c[0] * value + state[0];
    state[0] = c[1] * value - c[3] * output + state[1];
    state[1] = c[2] * value - c[4] * output;
    value = output;
  }
  return value;
}

static inline void crimson_eq_limit_frame(CrimsonEqualizerDSP *dsp, double *samples, int channels) {
  if (!dsp->initialized || (dsp->bypass && !dsp->remaining)) return;
  double peak = 0;
  for (int channel = 0; channel < channels; channel++) {
    if (!isfinite(samples[channel])) samples[channel] = 0;
    peak = fmax(peak, fabs(samples[channel]));
  }
  const double required = peak > CRIMSON_EQ_CEILING ? CRIMSON_EQ_CEILING / peak : 1;
  if (dsp->bypass) {
    // Recover during the filter transition; don't retain an old held reduction
    // and then jump to full volume when Flat/off becomes an exact bypass.
    dsp->limiterGain = fmin(required, dsp->limiterGain + (1.0 - dsp->limiterGain) / (dsp->remaining + 1));
    dsp->limiterHold = 0;
  } else if (required <= dsp->limiterGain + 0.000001) {
    // Equivalent periodic peaks differ slightly after Float32 conversion.
    // Refresh their hold without introducing bass-cycle gain modulation.
    dsp->limiterGain = fmin(dsp->limiterGain, required);
    dsp->limiterHold = dsp->limiterHoldFrames;
  } else if (dsp->limiterHold > 0) {
    dsp->limiterHold--;
  } else {
    dsp->limiterGain = fmin(required, 1.0 + (dsp->limiterGain - 1.0) * dsp->limiterRelease);
  }
  for (int channel = 0; channel < channels; channel++) samples[channel] *= dsp->limiterGain;
}

#endif
