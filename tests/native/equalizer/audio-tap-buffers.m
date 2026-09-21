// Exercise the installed Objective-C frame integration, not a mock of its loops.
// Compile with -I node_modules/expo-audio/ios after applying the config plugin.
#import "AudioTapProcessor.m"
#include <assert.h>
#include <stdio.h>

int main(void) {
  @autoreleasepool {
    enum { frames = 4096, guard = 8 };
    float stereo[(frames + guard) * 2], left[frames + guard], right[frames + guard];
    for (int frame = 0; frame < frames + guard; frame++) {
      const float sample = frame < frames ? (float)(0.95 * sin(6.283185307179586 * 40 * frame / 48000)) : 123.0f;
      stereo[frame * 2] = left[frame] = sample;
      stereo[frame * 2 + 1] = right[frame] = frame < frames ? -sample * 0.25f : 456.0f;
    }
    AudioTapProcessor *processor = [[AudioTapProcessor alloc] initWithPlayer:[[AVPlayer alloc] init]];
    [processor setCrimsonEqualizerEnabled:YES bands:@[@7, @3, @-1, @0, @0] preampDb:-1.4];
    AVAudioTapProcessorContext interleaved = {0}, planar = {0};
    interleaved.supportedTapProcessingFormat = planar.supportedTapProcessingFormat = true;
    interleaved.equalizerRevision = planar.equalizerRevision = UINT32_MAX;
    crimson_eq_reset(&interleaved.equalizer, 48000);
    crimson_eq_reset(&planar.equalizer, 48000);
    crimson_loudness_reset(&interleaved.loudness, 48000);
    crimson_loudness_reset(&planar.loudness, 48000);
    AudioBufferList stereoBuffers = { .mNumberBuffers = 1, .mBuffers = {{ .mNumberChannels = 2, .mDataByteSize = sizeof(stereo), .mData = stereo }} };
    struct { UInt32 mNumberBuffers; AudioBuffer mBuffers[2]; } planarBuffers = {
      .mNumberBuffers = 2, .mBuffers = {
        { .mNumberChannels = 1, .mDataByteSize = sizeof(left), .mData = left },
        { .mNumberChannels = 1, .mDataByteSize = sizeof(right), .mData = right }
      }
    };
    [processor processEqualizer:&stereoBuffers frames:frames context:&interleaved];
    [processor processEqualizer:(AudioBufferList *)&planarBuffers frames:frames context:&planar];
    float peak = 0;
    for (int frame = 0; frame < frames; frame++) {
      assert(stereo[frame * 2] == left[frame] && stereo[frame * 2 + 1] == right[frame]);
      assert(fabsf(right[frame] + left[frame] * 0.25f) < 1e-7f);
      assert(fabsf(left[frame]) <= 0.980001f);
      peak = fmaxf(peak, fabsf(left[frame]));
    }
    assert(peak > 0.979f);
    for (int frame = frames; frame < frames + guard; frame++) {
      assert(left[frame] == 123.0f && right[frame] == 456.0f);
      assert(stereo[frame * 2] == 123.0f && stereo[frame * 2 + 1] == 456.0f);
    }
    // A held limiter reduction must not survive the transition to Flat.
    [processor setCrimsonEqualizerEnabled:YES bands:@[@0, @0, @0, @0, @0] preampDb:0];
    for (int frame = 0; frame < frames; frame++) { left[frame] = 1.0f; right[frame] = -1.0f; }
    [processor processEqualizer:(AudioBufferList *)&planarBuffers frames:frames context:&planar];
    for (int frame = 1200; frame < frames; frame++) assert(left[frame] == 1.0f && right[frame] == -1.0f);
    // Normalization must operate with EQ flat and on the actual PCM buffers.
    [processor setCrimsonNormalizationEnabled:YES];
    crimson_loudness_reset(&planar.loudness, 48000);
    for (int frame = 0; frame < frames; frame++) { left[frame] = 0.8f; right[frame] = -0.8f; }
    [processor processEqualizer:(AudioBufferList *)&planarBuffers frames:frames context:&planar];
    assert(left[frames - 1] < 0.6f && left[frames - 1] > 0.125f);
    assert(right[frames - 1] == -left[frames - 1]);
    for (int frame = frames; frame < frames + guard; frame++) assert(left[frame] == 123.0f && right[frame] == 456.0f);
    puts("PASS actual AudioTapProcessor: interleaved/planar identical, stereo-linked output, source-frame bounds, full-scale Flat after25ms");
  }
  return 0;
}
