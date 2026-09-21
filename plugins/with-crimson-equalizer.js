/* global __dirname */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const MARKER = '// Crimson equalizer adapter v1';
const FRAME_MARKER = '// Crimson equalizer linked frame limiter v2';
const sources = path.join(__dirname, 'crimson-equalizer');
function replace(source, anchor, value) {
  if (!source.includes(anchor)) throw new Error(`Crimson EQ: Expo Audio 57.0.5 anchor changed: ${anchor.slice(0, 100)}`);
  return source.replace(anchor, value);
}

function patchIOSTapLimiter(source) {
  if (source.includes(FRAME_MARKER)) return source;
  const method = source.indexOf('- (void)processEqualizer:');
  const start = source.indexOf('  for (CMItemCount frame = 0; frame < frames; frame++) {', method);
  const end = source.indexOf('\n}\n\n- (BOOL)isTapInstalled', start);
  if (method < 0 || start < 0 || end < 0) throw new Error('Crimson EQ: existing tap processing changed; review the frame limiter upgrade.');
  return source.slice(0, start) + `  ${FRAME_MARKER}
  if (context->equalizer.bypass && !context->equalizer.remaining) return;
  int channelCount = 0;
  for (UInt32 index = 0; index < buffers->mNumberBuffers; index++) {
    if (buffers->mBuffers[index].mNumberChannels > CRIMSON_EQ_CHANNELS - channelCount) return;
    channelCount += buffers->mBuffers[index].mNumberChannels;
  }
  double frameSamples[CRIMSON_EQ_CHANNELS];
  for (CMItemCount frame = 0; frame < frames; frame++) {
    crimson_eq_frame(&context->equalizer);
    int channelOffset = 0;
    for (UInt32 bufferIndex = 0; bufferIndex < buffers->mNumberBuffers; bufferIndex++) {
      AudioBuffer *buffer = &buffers->mBuffers[bufferIndex];
      const float *samples = buffer->mData;
      const UInt32 channels = buffer->mNumberChannels;
      const bool available = samples && (frame + 1) * channels * sizeof(float) <= buffer->mDataByteSize;
      for (UInt32 channel = 0; channel < channels; channel++) {
        const double input = available ? samples[frame * channels + channel] : 0;
        frameSamples[channelOffset + channel] = crimson_eq_sample(&context->equalizer, input, channelOffset + channel);
      }
      channelOffset += channels;
    }
    crimson_eq_limit_frame(&context->equalizer, frameSamples, channelCount);
    channelOffset = 0;
    for (UInt32 bufferIndex = 0; bufferIndex < buffers->mNumberBuffers; bufferIndex++) {
      AudioBuffer *buffer = &buffers->mBuffers[bufferIndex];
      float *samples = buffer->mData;
      const UInt32 channels = buffer->mNumberChannels;
      if (samples && (frame + 1) * channels * sizeof(float) <= buffer->mDataByteSize) {
        for (UInt32 channel = 0; channel < channels; channel++) samples[frame * channels + channel] = (float)frameSamples[channelOffset + channel];
      }
      channelOffset += channels;
    }
  }` + source.slice(end);
}

function patchIOSPlayer(source) {
  source = replace(source, '  private var tapInstalled = false', `  private var crimsonEqualizerPrepared = false
  private var crimsonEqualizerEnabled = false
  private var crimsonEqualizerBands: [Double] = [0, 0, 0, 0, 0]
  private var crimsonEqualizerPreamp = 0.0
  private weak var crimsonTapItem: AVPlayerItem?
  private var tapInstalled = false`);
  source = replace(source, '  func setSamplingEnabled(enabled: Bool) {', `  // Prepare even while disabled, before playback. Settings only update the existing DSP.
  func setCrimsonEqualizer(enabled: Bool, bands: [Double], preampDb: Double) -> Bool {
    crimsonEqualizerEnabled = enabled
    crimsonEqualizerBands = (0..<5).map { index in
      let gain = index < bands.count ? bands[index] : 0
      return gain.isFinite ? min(12, max(-12, gain)) : 0
    }
    crimsonEqualizerPreamp = preampDb.isFinite ? min(0, max(-72, preampDb)) : 0
    if !crimsonEqualizerPrepared {
      crimsonEqualizerPrepared = true
      if isLoaded { installTap() } else { shouldInstallAudioTap = true }
    }
    audioProcessor?.setCrimsonEqualizer(enabled: enabled, bands: crimsonEqualizerBands.map { NSNumber(value: $0) }, preampDb: crimsonEqualizerPreamp)
    return !isLoaded || audioProcessor?.isTapInstalled == true
  }

  func setSamplingEnabled(enabled: Bool) {`);
  source = replace(source, `    } else {
      uninstallTap()
      shouldInstallAudioTap = false
    }
  }

  func currentStatus`, `    } else if !crimsonEqualizerPrepared {
      uninstallTap()
      shouldInstallAudioTap = false
    }
  }

  func currentStatus`);
  source = source.replaceAll('if shouldInstallAudioTap || samplingEnabled {', 'if shouldInstallAudioTap || samplingEnabled || crimsonEqualizerPrepared {')
    .replaceAll('if self.samplingEnabled && self.isLoaded {', 'if (self.samplingEnabled || self.crimsonEqualizerPrepared) && self.isLoaded && self.crimsonTapItem !== self.ref.currentItem {')
    .replaceAll('let wasSamplingEnabled = samplingEnabled', 'let wasSamplingEnabled = samplingEnabled || crimsonEqualizerPrepared')
    .replaceAll('if samplingEnabled {\n      uninstallTap()', 'if samplingEnabled || crimsonEqualizerPrepared {\n      uninstallTap()');
  source = replace(source, '    guard audioProcessor?.isTapInstalled != true else {', '    guard audioProcessor?.isTapInstalled != true || crimsonTapItem !== ref.currentItem else {');
  source = replace(source, '    tapInstalled = success\n', '    tapInstalled = success\n    crimsonTapItem = success ? ref.currentItem : nil\n');
  source = replace(source, '  private func uninstallTap() {\n', '  private func uninstallTap() {\n    crimsonTapItem = nil\n');
  return replace(source, '    audioProcessor = AudioTapProcessor(player: ref)', `    audioProcessor = AudioTapProcessor(player: ref)
    audioProcessor?.setCrimsonEqualizer(enabled: crimsonEqualizerEnabled, bands: crimsonEqualizerBands.map { NSNumber(value: $0) }, preampDb: crimsonEqualizerPreamp)`);
}

function patchIOSTap(source) {
  source = replace(source, '#import <os/lock.h>', '#import <os/lock.h>\n#import <stdatomic.h>\n#import "CrimsonEqualizerDSP.h"');
  source = replace(source, '  Boolean isValid;\n', '  Boolean isValid;\n  CrimsonEqualizerDSP equalizer;\n  uint32_t equalizerRevision;\n');
  source = replace(source, '  BOOL _isInvalidated;\n', '  BOOL _isInvalidated;\n  AVPlayerItem *_installedItem;\n  atomic_uint _eqRevision;\n  atomic_bool _eqEnabled;\n  _Atomic(float) _eqBands[5];\n  _Atomic(float) _eqPreamp;\n');
  source = replace(source, '    _audioProcessingTap = NULL;\n', `    _audioProcessingTap = NULL;
    atomic_init(&_eqRevision, 0);
    atomic_init(&_eqEnabled, false);
    atomic_init(&_eqPreamp, 0);
    for (int i = 0; i < 5; i++) atomic_init(&_eqBands[i], 0);
`);
  source = replace(source, '- (BOOL)isTapInstalled {', `- (void)setCrimsonEqualizerEnabled:(BOOL)enabled bands:(NSArray<NSNumber *> *)bands preampDb:(double)preampDb {
  // The Expo function runs on its serial/main queue. A bounded seqlock read on
  // the render thread never blocks behind settings changes.
  atomic_fetch_add_explicit(&_eqRevision, 1, memory_order_acq_rel);
  atomic_store_explicit(&_eqEnabled, enabled, memory_order_relaxed);
  for (int i = 0; i < 5; i++) {
    float gain = i < bands.count ? bands[i].floatValue : 0;
    atomic_store_explicit(&_eqBands[i], isfinite(gain) ? fmaxf(-12, fminf(12, gain)) : 0, memory_order_relaxed);
  }
  atomic_store_explicit(&_eqPreamp, isfinite(preampDb) ? fmax(-72, fmin(0, preampDb)) : 0, memory_order_relaxed);
  atomic_fetch_add_explicit(&_eqRevision, 1, memory_order_release);
}

- (void)processEqualizer:(AudioBufferList *)buffers frames:(CMItemCount)frames context:(AVAudioTapProcessorContext *)context {
  if (!context->supportedTapProcessingFormat || !buffers || frames <= 0) return;
  uint32_t revision = atomic_load_explicit(&_eqRevision, memory_order_acquire);
  if (!(revision & 1) && revision != context->equalizerRevision) {
    float bands[5];
    bool enabled = atomic_load_explicit(&_eqEnabled, memory_order_relaxed);
    float preamp = atomic_load_explicit(&_eqPreamp, memory_order_relaxed);
    for (int i = 0; i < 5; i++) bands[i] = atomic_load_explicit(&_eqBands[i], memory_order_relaxed);
    if (revision == atomic_load_explicit(&_eqRevision, memory_order_acquire)) {
      crimson_eq_configure(&context->equalizer, enabled, bands, preamp);
      context->equalizerRevision = revision;
    }
  }
  for (CMItemCount frame = 0; frame < frames; frame++) {
    crimson_eq_frame(&context->equalizer);
    int channelOffset = 0;
    for (UInt32 bufferIndex = 0; bufferIndex < buffers->mNumberBuffers; bufferIndex++) {
      AudioBuffer *buffer = &buffers->mBuffers[bufferIndex];
      float *samples = buffer->mData;
      const UInt32 channels = buffer->mNumberChannels;
      if (samples && (frame + 1) * channels * sizeof(float) <= buffer->mDataByteSize) {
        for (UInt32 channel = 0; channel < channels; channel++) {
          const CMItemCount index = frame * channels + channel;
          samples[index] = crimson_eq_sample(&context->equalizer, samples[index], channelOffset + channel);
        }
      }
      channelOffset += channels;
    }
  }
}

- (BOOL)isTapInstalled {`);
  source = replace(source, '    context->isNonInterleaved = false;', '    context->isNonInterleaved = false;\n    context->equalizerRevision = UINT32_MAX;');
  source = replace(source, '  context->supportedTapProcessingFormat = true;', `  if (!context || !processingFormat) return;
  context->supportedTapProcessingFormat = processingFormat->mFormatID == kAudioFormatLinearPCM
    && (processingFormat->mFormatFlags & kAudioFormatFlagIsFloat)
    && processingFormat->mBitsPerChannel == 32
    && processingFormat->mChannelsPerFrame <= CRIMSON_EQ_CHANNELS;
  crimson_eq_reset(&context->equalizer, processingFormat->mSampleRate);
  context->equalizerRevision = UINT32_MAX;`);
  source = replace(source, '  SampleBufferCallback callback = processor.sampleBufferCallback;', '  [processor processEqualizer:bufferListInOut frames:*numberFramesOut context:context];\n\n  SampleBufferCallback callback = processor.sampleBufferCallback;');
  source = replace(source, '    [_player.currentItem setAudioMix:audioMix];', '    _installedItem = _player.currentItem;\n    [_installedItem setAudioMix:audioMix];');
  source = source.replaceAll('[_player.currentItem setAudioMix:nil]', '[_installedItem setAudioMix:nil]');
  // Balance MTAudioProcessingTapCreate after invalidating its context. The item
  // and any in-flight render callback retain their own tap reference.
  source = source.replaceAll('    _audioProcessingTap = NULL;\n  }', '    if (_audioProcessingTap) CFRelease(_audioProcessingTap);\n    _audioProcessingTap = NULL;\n    _installedItem = nil;\n  }');
  return patchIOSTapLimiter(source);
}

function patchEqualizer(projectRoot, platforms = ['ios', 'android']) {
  const packagePath = require.resolve('expo-audio/package.json', { paths: [projectRoot] });
  if (JSON.parse(fs.readFileSync(packagePath, 'utf8')).version !== '57.0.5') throw new Error('Review Crimson equalizer before upgrading expo-audio 57.0.5.');
  const root = path.dirname(packagePath);
  const pending = new Map();
  const patch = (relative, transform) => {
    const file = path.join(root, relative);
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes(MARKER)) pending.set(file, `${MARKER}\n${transform(source)}`);
  };
  if (platforms.includes('ios')) {
    patch('ios/AudioPlayer.swift', patchIOSPlayer);
    patch('ios/AudioTapProcessor.m', patchIOSTap);
    const tapFile = path.join(root, 'ios/AudioTapProcessor.m');
    pending.set(tapFile, patchIOSTapLimiter(pending.get(tapFile) || fs.readFileSync(tapFile, 'utf8')));
    patch('ios/AudioTapProcessor.h', (source) => replace(source, '- (BOOL)installTap;', '- (void)setCrimsonEqualizerEnabled:(BOOL)enabled bands:(NSArray<NSNumber *> *)bands preampDb:(double)preampDb NS_SWIFT_NAME(setCrimsonEqualizer(enabled:bands:preampDb:));\n- (BOOL)installTap;'));
    patch('ios/AudioModule.swift', (source) => replace(source, '      Function("setAudioSamplingEnabled")', `      Function("setCrimsonEqualizer") { (player: AudioPlayer, enabled: Bool, bands: [Double], preampDb: Double) -> Bool in
        player.setCrimsonEqualizer(enabled: enabled, bands: bands, preampDb: preampDb)
      }

      Function("setAudioSamplingEnabled")`));
    pending.set(path.join(root, 'ios/CrimsonEqualizerDSP.h'), fs.readFileSync(path.join(sources, 'CrimsonEqualizerDSP.h'), 'utf8'));
  }
  if (platforms.includes('android')) {
    // The existing PCM sample adapter must precede EQ; this is also safe on fresh npm installs.
    require('./with-android-media-controls').patchAndroidMedia(projectRoot);
    const kotlin = 'android/src/main/java/expo/modules/audio/';
    patch(`${kotlin}AudioPlayer.kt`, (source) => replace(source, '  fun setSamplingEnabled(enabled: Boolean)', `  fun setCrimsonEqualizer(enabled: Boolean, bands: List<Double>, preampDb: Double): Boolean {
    crimsonSamples.equalizer.configureEqualizer(enabled, bands, preampDb)
    return true
  }

  fun setSamplingEnabled(enabled: Boolean)`));
    patch(`${kotlin}AudioModule.kt`, (source) => replace(source, '      Function("setAudioSamplingEnabled")', `      Function("setCrimsonEqualizer") { player: AudioPlayer, enabled: Boolean, bands: List<Double>, preampDb: Double ->
        player.setCrimsonEqualizer(enabled, bands, preampDb)
      }

      Function("setAudioSamplingEnabled")`));
    pending.set(path.join(root, kotlin, 'CrimsonEqualizerProcessor.kt'), fs.readFileSync(path.join(sources, 'CrimsonEqualizerProcessor.kt'), 'utf8'));
  }
  for (const [file, source] of pending) fs.writeFileSync(file, source);
  if (platforms.includes('ios')) require('./with-crimson-playback-controls').patchPlaybackControls(projectRoot);
}

module.exports = function withCrimsonEqualizer(config) {
  for (const platform of ['ios', 'android']) config = withDangerousMod(config, [platform, (mod) => {
    patchEqualizer(mod.modRequest.projectRoot, [platform]);
    return mod;
  }]);
  return config;
};
module.exports.patchEqualizer = patchEqualizer;
