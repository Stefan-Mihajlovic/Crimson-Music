#include "CrimsonLoudnessDSP.h"
#include <assert.h>
#include <stdio.h>
static double render(double amplitude, int rate) {
  CrimsonLoudnessDSP dsp;
  crimson_loudness_reset(&dsp, rate);
  double sum = 0;
  for (int i = 0; i < rate * 25; i++) {
    double sample = amplitude * sin(6.28318530718 * 440 * i / rate);
    double frame[2] = { sample, -sample };
    crimson_loudness_frame(&dsp, frame, 2, true);
    assert(isfinite(frame[0]) && fabs(frame[0]) <= 0.980001);
    assert(fabs(frame[0] + frame[1]) < 1e-12);
    if (i >= rate * 24) sum += frame[0] * frame[0];
  }
  double rms = sqrt(sum / rate);
  double silence[2] = {0, 0};
  for (int i = 0; i < rate; i++) crimson_loudness_frame(&dsp, silence, 2, true);
  assert(silence[0] == 0 && silence[1] == 0);
  double peak[2] = {5, -5};
  crimson_loudness_frame(&dsp, peak, 2, false);
  assert(fabs(peak[0]) <= 0.98);
  for (int i = 0; i < rate * 40; i++) { double x[1] = {.1}; crimson_loudness_frame(&dsp, x, 1, false); }
  assert(fabs(dsp.gain - 1) < 0.00001);
  return rms;
}
int main(void) {
  for (int rate = 44100; rate <= 96000; rate += rate == 44100 ? 3900 : 48000) {
    double quiet = render(.1, rate), loud = render(.8, rate);
    assert(fabs(quiet - .125) < .002);
    assert(fabs(loud - .125) < .002);
  }
  CrimsonLoudnessDSP dsp;
  crimson_loudness_reset(&dsp, 48000);
  double x[2] = {.25, -.25};
  crimson_loudness_frame(&dsp, x, 2, false);
  assert(x[0] == .25 && x[1] == -.25);
  puts("PASS loudness: level matching, silence, stereo, ceiling, disable recovery, exact initial bypass");
}
