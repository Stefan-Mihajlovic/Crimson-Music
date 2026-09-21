/* global __dirname */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const MARKER = '// Crimson native sleep timer adapter v1';
const template = (name) => fs.readFileSync(path.join(__dirname, 'crimson-sleep-timer', name), 'utf8');
function replaceRequired(source, anchor, replacement, label) {
  if (!source.includes(anchor)) throw new Error(`Crimson sleep timer: Expo Audio ${label} changed; review the adapter before building.`);
  return source.replace(anchor, replacement);
}

function patchIosPlayer(source) {
  source = replaceRequired(source, '  private var source: AudioSource?', `${template('AudioPlayer.swift.inc')}  private var source: AudioSource?`, 'iOS player fields');
  source = replaceRequired(source, '  func play(at rate: Float) {', '  func play(at rate: Float) {\n    guard !crimsonSleepTimerBlocksPlayback() else { return }', 'iOS playback');
  source = replaceRequired(source, '  func resumePlayback() {', '  func resumePlayback() {\n    guard !crimsonSleepTimerBlocksPlayback() else { return }', 'iOS interruption resume');
  source = replaceRequired(source, '  private func setupPublisher() {', `  private func setupPublisher() {
    ref.publisher(for: \\.rate)
      .sink { [weak self] rate in
        guard let self, rate > 0 else { return }
        if self.crimsonSleepTimerBlocksPlayback() { self.ref.pause() }
      }
      .store(in: &cancellables)
`, 'iOS transport observation');
  return replaceRequired(source, '  public override func sharedObjectWillRelease() {', '  public override func sharedObjectWillRelease() {\n    setCrimsonSleepTimer(0)', 'iOS cleanup');
}

function patchAndroidPlayer(source) {
  source = replaceRequired(source, '  var preservesPitch = true', `${template('AudioPlayer.kt.inc')}  var preservesPitch = true`, 'Android player fields');
  source = replaceRequired(source, '    installPlayerListeners()', '    installPlayerListeners()\n    ref.addListener(crimsonSleepListener)', 'Android transport observation');
  return replaceRequired(source, '  override fun releasePlayer() {', '  override fun releasePlayer() {\n    setCrimsonSleepTimer(0.0)\n    ref.removeListener(crimsonSleepListener)', 'Android cleanup');
}

function patchIosModule(source) {
  const anchor = '      Function("play") { player in';
  return replaceRequired(source, anchor, `      Function("setCrimsonSleepTimer") { (player: AudioPlayer, deadlineAt: Double) in
        player.setCrimsonSleepTimer(deadlineAt)
      }

      Property("crimsonSleepTimerExpiredAt") { (player: AudioPlayer) in
        player.crimsonSleepTimerExpiredAt
      }

${anchor}`, 'iOS player class');
}

function patchAndroidModule(source) {
  const anchor = '      Function("play") { player: AudioPlayer ->';
  source = replaceRequired(source, anchor, `      Function("setCrimsonSleepTimer") { player: AudioPlayer, deadlineAt: Double ->
        runOnMain { player.setCrimsonSleepTimer(deadlineAt) }
      }

      Property("crimsonSleepTimerExpiredAt") { player: AudioPlayer ->
        player.crimsonSleepTimerExpiredAt
      }

${anchor}`, 'Android player class');
  // This exact first occurrence belongs to the AudioPlayer class above.
  return replaceRequired(source, '          player.ref.play()\n', '          if (!player.crimsonSleepTimerBlocksPlayback()) player.ref.play()\n', 'Android playback');
}

function patchCrimsonSleepTimer(projectRoot) {
  const packagePath = require.resolve('expo-audio/package.json', { paths: [projectRoot] });
  const version = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
  if (version !== '57.0.5') throw new Error(`Crimson sleep timer supports expo-audio 57.0.5; review it before upgrading from ${version}.`);
  const directory = path.dirname(packagePath);
  const targets = [
    ['ios/AudioPlayer.swift', patchIosPlayer], ['ios/AudioModule.swift', patchIosModule],
    ['android/src/main/java/expo/modules/audio/AudioPlayer.kt', patchAndroidPlayer],
    ['android/src/main/java/expo/modules/audio/AudioModule.kt', patchAndroidModule],
  ];
  const changes = targets.flatMap(([relative, transform]) => {
    const file = path.join(directory, relative);
    const source = fs.readFileSync(file, 'utf8');
    return source.includes(MARKER) ? [] : [[file, `${MARKER}\n${transform(source)}`]];
  });
  for (const [file, source] of changes) fs.writeFileSync(file, source);
}

module.exports = function withCrimsonSleepTimer(config) {
  for (const platform of ['ios', 'android']) config = withDangerousMod(config, [platform, async (mod) => {
    patchCrimsonSleepTimer(mod.modRequest.projectRoot);
    return mod;
  }]);
  return config;
};
module.exports.patchCrimsonSleepTimer = patchCrimsonSleepTimer;
