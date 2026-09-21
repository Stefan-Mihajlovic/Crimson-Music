#include "CrimsonEqualizerDSP.h"
#include <assert.h>
#include <stdio.h>

static const double frequencies[] = {100, 300, 1000, 4000, 10000};
static const double tau = 6.283185307179586;

static void process(CrimsonEqualizerDSP *dsp, double samples[2]) {
  crimson_eq_frame(dsp);
  for (int channel = 0; channel < 2; channel++) samples[channel] = crimson_eq_sample(dsp, samples[channel], channel);
  crimson_eq_limit_frame(dsp, samples, 2);
}

static double tone_gain(int band, float gain, double rate, double frequency, float preamp) {
  CrimsonEqualizerDSP dsp;
  crimson_eq_reset(&dsp, rate);
  float bands[5] = {0}; bands[band] = gain;
  crimson_eq_configure(&dsp, true, bands, preamp);
  double inputPower = 0, outputPower = 0;
  for (int frame = 0; frame < (int)rate; frame++) {
    const double input = 0.01 * sin(tau * frequency * frame / rate);
    double samples[2] = {input, 0};
    process(&dsp, samples);
    assert(samples[1] == 0);
    if (frame > (int)(rate / 2)) { inputPower += input * input; outputPower += samples[0] * samples[0]; }
  }
  return 10 * log10(outputPower / inputPower);
}

static void check_response(void) {
  for (int band = 0; band < 5; band++) for (int gain = -12; gain <= 12; gain += 6) {
    if (gain == 0) continue; // Flat ignores preamp and bypasses exactly.
    for (int rate = 22050; rate <= 48000; rate += 25950) {
      double measured = tone_gain(band, gain, rate, fmin(frequencies[band], rate * 0.45), -1);
      double expected = (band == 0 || band == 4 ? gain / 2.0 : gain) - 1;
      assert(fabs(measured - expected) < 0.01);
    }
  }
  assert(tone_gain(0, 7, 48000, 30, -1.4f) > 5.4);
  assert(tone_gain(4, 6, 48000, 20000, -1.2f) > 4.6);
  puts("PASS shelves: low30Hz >+5.4dB, high20kHz >+4.6dB; shelf centers half gain, peaking centers full gain at22.05/48kHz");
}

static void check_limiter(void) {
  CrimsonEqualizerDSP dsp;
  float bands[5] = {7, 3, -1, 0, 0};
  crimson_eq_reset(&dsp, 48000);
  crimson_eq_configure(&dsp, true, bands, 0);
  double impulse[2] = {2, -0.5};
  crimson_eq_limit_frame(&dsp, impulse, 2);
  assert(fabs(impulse[0] - 0.98) < 1e-12 && fabs(impulse[1] + 0.245) < 1e-12);
  assert(dsp.limiterHold == 1440 && dsp.limiterGain == 0.49);
  for (int i = 0; i < 1440; i++) {
    double quiet[2] = {0.2, -0.1}; crimson_eq_limit_frame(&dsp, quiet, 2);
    assert(dsp.limiterGain == 0.49);
  }
  double previous = dsp.limiterGain;
  for (int i = 0; i < 7200; i++) {
    double quiet[2] = {0.2, -0.1}; crimson_eq_limit_frame(&dsp, quiet, 2);
    assert(dsp.limiterGain > previous && dsp.limiterGain <= 1);
    previous = dsp.limiterGain;
  }
  assert(fabs(dsp.limiterGain - (1 - 0.51 / exp(1))) < 1e-10);
  crimson_eq_reset(&dsp, 48000); crimson_eq_configure(&dsp, true, bands, -1.4f);
  double peak = 0;
  int ceilingSamples = 0;
  for (int i = 0; i < 96000; i++) {
    double input = 0.95 * sin(tau * 40 * i / 48000);
    double samples[2] = {input, -input * 0.25}; process(&dsp, samples);
    assert(fabs(samples[1] + samples[0] * 0.25) < 1e-10);
    assert(isfinite(samples[0]) && fabs(samples[0]) <= 0.9800000001);
    if (i > 24000) { peak = fmax(peak, fabs(samples[0])); if (fabs(samples[0]) > 0.979999) ceilingSamples++; }
  }
  assert(peak > 0.979 && ceilingSamples < 1000);
  printf("PASS linked limiter: 40Hz peak %.6f, %d ceiling samples, exact30ms hold and150ms exponential release\n", peak, ceilingSamples);
  float flat[5] = {0};
  crimson_eq_configure(&dsp, true, flat, -2);
  for (int i = 0; i < 1200; i++) { double samples[2] = {0.2, -0.1}; process(&dsp, samples); }
  assert(dsp.limiterGain == 1 && dsp.limiterHold == 0);
  for (int i = -32768; i < 32768; i++) {
    double input = i / 32768.0, samples[2] = {input, -input}; process(&dsp, samples);
    assert(samples[0] == input && samples[1] == -input);
  }
  crimson_eq_reset(&dsp, 44100); crimson_eq_configure(&dsp, false, bands, -2);
  double fullScale[2] = {1, -1}; process(&dsp, fullScale);
  assert(fullScale[0] == 1 && fullScale[1] == -1);
  puts("PASS Flat/off exact passthrough,25ms transition clears held reduction; source reset clears histories");
}

static double fixture(int frame, int channel) {
  const double time = frame / 48000.0;
  const double phase = channel * 0.19;
  const double envelope = 0.45 + 0.55 * exp(-8 * (frame % 24000) / 48000.0);
  const uint32_t random = (uint32_t)(frame + channel * 17011) * 1664525u + 1013904223u;
  const double noise = random / 4294967296.0 - 0.5;
  return envelope * (0.5 * sin(tau * 55 * time + phase) + 0.25 * sin(tau * 110 * time + phase))
    + 0.16 * sin(tau * 440 * time + phase) + 0.10 * sin(tau * 880 * time + phase)
    + 0.05 * sin(tau * 5600 * time + phase) + 0.02 * noise;
}

static void check_music_loudness(void) {
  double inputPeak = 0;
  for (int i = 0; i < 96000; i++) for (int ch = 0; ch < 2; ch++) inputPeak = fmax(inputPeak, fabs(fixture(i, ch)));
  const double peaks[] = {0.25, 0.65, 0.95};
  for (int level = 0; level < 3; level++) {
    CrimsonEqualizerDSP current, previous;
    float bass[5] = {7, 3, -1, 0, 0};
    crimson_eq_reset(&current, 48000); crimson_eq_configure(&current, true, bass, -1.4f);
    // Shipped v1: five peaking bands and -7.6dB Bass boost preamp.
    crimson_eq_reset(&previous, 48000); previous.initialized = true;
    previous.gain = pow(10, -7.6 / 20.0);
    const double oldFrequencies[] = {60, 230, 910, 3600, 14000}, oldBands[] = {6, 4, 0, -1, 0};
    for (int b = 0; b < 5; b++) crimson_eq_coefficients(2, oldFrequencies[b], oldBands[b], 48000, previous.coefficients[b]);
    double inputPower = 0, outputPower = 0, previousPower = 0, peak = 0;
    for (int i = 0; i < 96000; i++) {
      double samples[2];
      for (int ch = 0; ch < 2; ch++) {
        samples[ch] = fixture(i, ch) * peaks[level] / inputPeak;
        double old = crimson_eq_sample(&previous, samples[ch], ch);
        if (i >= 24000) { inputPower += samples[ch] * samples[ch]; previousPower += old * old; }
      }
      process(&current, samples);
      for (int ch = 0; ch < 2; ch++) { peak = fmax(peak, fabs(samples[ch])); if (i >= 24000) outputPower += samples[ch] * samples[ch]; }
    }
    const double gain = 10 * log10(outputPower / inputPower), improvement = 10 * log10(outputPower / previousPower);
    assert(gain > 1 && improvement > 3 && peak <= 0.9800000001);
    printf("PASS music PCM inputPeak %.2f: RMS %+0.2fdB vs Flat, %+0.2fdB vs v1, outputPeak %.6f\n", peaks[level], gain, improvement, peak);
  }
}

int main(void) {
  check_response(); check_limiter(); check_music_loudness();
  return 0;
}
