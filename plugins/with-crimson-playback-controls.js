/* global __dirname */
const fs = require('fs');
const path = require('path');
const marker = '// Crimson playback controls v1';
function patchPlaybackControls(projectRoot) {
  const root = path.dirname(require.resolve('expo-audio/package.json', { paths: [projectRoot] }));
  const patch = (file, transform) => {
    const target = path.join(root, 'ios', file);
    const source = fs.readFileSync(target, 'utf8');
    if (!source.includes(marker)) fs.writeFileSync(target, `${marker}\n${transform(source)}`);
  };
  const replace = (source, anchor, next) => {
    if (!source.includes(anchor)) throw new Error(`Crimson playback: missing ${anchor}`);
    return source.replace(anchor, next);
  };
  patch('AudioPlayer.swift', (source) => {
    source = replace(source, '  private var crimsonEqualizerPrepared', '  private var crimsonNormalizationEnabled = false\n  private var crimsonEqualizerPrepared');
    source = replace(source, '  func setCrimsonEqualizer(', `  func setCrimsonNormalization(enabled: Bool) {
    crimsonNormalizationEnabled = enabled
    audioProcessor?.setCrimsonNormalizationEnabled(enabled)
  }

  func setCrimsonEqualizer(`);
    source = replace(source, '    audioProcessor = AudioTapProcessor(player: ref)', '    audioProcessor = AudioTapProcessor(player: ref)\n    audioProcessor?.setCrimsonNormalizationEnabled(crimsonNormalizationEnabled)');
    source = replace(source, '    ref.playImmediately(atRate: rate)', '    ref.currentItem?.audioTimePitchAlgorithm = shouldCorrectPitch ? pitchCorrectionQuality : .varispeed\n    ref.playImmediately(atRate: rate)');
    return source;
  });
  patch('AudioModule.swift', (source) => replace(source, '      Function("setCrimsonEqualizer")', `      Function("setCrimsonNormalization") { (player: AudioPlayer, enabled: Bool) in
        player.setCrimsonNormalization(enabled: enabled)
      }
      Function("setCrimsonEqualizer")`));
  patch('AudioTapProcessor.h', (source) => replace(source, '- (BOOL)installTap;', '- (void)setCrimsonNormalizationEnabled:(BOOL)enabled;\n- (BOOL)installTap;'));
  patch('AudioTapProcessor.m', (source) => {
    source = replace(source, '#import "CrimsonEqualizerDSP.h"', '#import "CrimsonEqualizerDSP.h"\n#import "CrimsonLoudnessDSP.h"');
    source = replace(source, '  CrimsonEqualizerDSP equalizer;', '  CrimsonEqualizerDSP equalizer;\n  CrimsonLoudnessDSP loudness;');
    source = replace(source, '  atomic_bool _eqEnabled;', '  atomic_bool _eqEnabled;\n  atomic_bool _normalizationEnabled;');
    source = replace(source, '    atomic_init(&_eqEnabled, false);', '    atomic_init(&_eqEnabled, false);\n    atomic_init(&_normalizationEnabled, false);');
    source = replace(source, '- (BOOL)isTapInstalled {', '- (void)setCrimsonNormalizationEnabled:(BOOL)enabled {\n  atomic_store_explicit(&_normalizationEnabled, enabled, memory_order_relaxed);\n}\n\n- (BOOL)isTapInstalled {');
    source = replace(source, '  if (context->equalizer.bypass && !context->equalizer.remaining) return;', '  const bool normalize = atomic_load_explicit(&_normalizationEnabled, memory_order_relaxed);\n  if (context->equalizer.bypass && !context->equalizer.remaining && !normalize && fabs(context->loudness.gain - 1) < 0.00001) return;');
    source = replace(source, '    crimson_eq_limit_frame(&context->equalizer, frameSamples, channelCount);', '    crimson_eq_limit_frame(&context->equalizer, frameSamples, channelCount);\n    crimson_loudness_frame(&context->loudness, frameSamples, channelCount, normalize);');
    source = replace(source, '  crimson_eq_reset(&context->equalizer, processingFormat->mSampleRate);', '  crimson_eq_reset(&context->equalizer, processingFormat->mSampleRate);\n  crimson_loudness_reset(&context->loudness, processingFormat->mSampleRate);');
    return source;
  });
  // Preserve speed after audio-session interruptions and pitch on repeat items.
  const playerFile = path.join(root, 'ios/AudioPlayer.swift');
  let player = fs.readFileSync(playerFile, 'utf8');
  const resumeMarker = '// Crimson playback resume and queued pitch v2';
  if (!player.includes(resumeMarker)) {
    player = replace(player, '    ref.play()\n  }\n\n  public override func sharedObjectWillRelease()', '    play(at: effectiveRate)\n  }\n\n  public override func sharedObjectWillRelease()');
    player = replace(player, '  private func replacePlayerItem(with item: AVPlayerItem?) {', '  private func replacePlayerItem(with item: AVPlayerItem?) {\n    item?.audioTimePitchAlgorithm = shouldCorrectPitch ? pitchCorrectionQuality : .varispeed');
    player = replace(player, '    nextItem.audioTimePitchAlgorithm = currentItem.audioTimePitchAlgorithm', '    nextItem.audioTimePitchAlgorithm = shouldCorrectPitch ? pitchCorrectionQuality : .varispeed');
    fs.writeFileSync(playerFile, `${resumeMarker}\n${player}`);
  }
  const moduleFile = path.join(root, 'ios/AudioModule.swift');
  let module = fs.readFileSync(moduleFile, 'utf8');
  if (!module.includes(resumeMarker)) {
    module = replace(module, `          player.ref.currentItem?.audioTimePitchAlgorithm = .varispeed
        }
      }`, `          player.ref.currentItem?.audioTimePitchAlgorithm = .varispeed
        }
        if let queue = player.ref as? AVQueuePlayer {
          for item in queue.items() {
            item.audioTimePitchAlgorithm = player.shouldCorrectPitch ? player.pitchCorrectionQuality : .varispeed
          }
        }
      }`);
    fs.writeFileSync(moduleFile, `${resumeMarker}\n${module}`);
  }
  fs.copyFileSync(path.join(__dirname, 'crimson-equalizer/CrimsonLoudnessDSP.h'), path.join(root, 'ios/CrimsonLoudnessDSP.h'));
}
module.exports.patchPlaybackControls = patchPlaybackControls;
