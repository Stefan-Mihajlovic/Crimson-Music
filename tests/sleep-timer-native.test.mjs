import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setNativeSleepDeadline, nativeSleepExpired } from '../src/services/sleep-timer-platform.ts';

const require = createRequire(import.meta.url);
const { patchCrimsonSleepTimer } = require('../plugins/with-crimson-sleep-timer.js');

test('native adapter arms and clears both raw decks and only accepts the matching expired deadline', () => {
  const calls = [];
  const first = { setCrimsonSleepTimer: (deadline) => calls.push(['first', deadline]), crimsonSleepTimerExpiredAt: 123 },
    second = { setCrimsonSleepTimer: (deadline) => calls.push(['second', deadline]), crimsonSleepTimerExpiredAt: 0 };
  assert.equal(setNativeSleepDeadline([first, second, first], 456), true);
  assert.deepEqual(calls, [['first', 456], ['second', 456]]);
  assert.equal(nativeSleepExpired([first, second], 456), false);
  second.crimsonSleepTimerExpiredAt = 456;
  assert.equal(nativeSleepExpired([first, second], 456), true);
  assert.equal(nativeSleepExpired([first, second], 0), false);
  setNativeSleepDeadline([first, second], 0);
  assert.deepEqual(calls.slice(-2), [['first', 0], ['second', 0]]);
  calls.length = 0;
  assert.equal(setNativeSleepDeadline([first, {}], 789), false);
  assert.deepEqual(calls.at(-1), ['first', 0], 'unsupported second deck cannot leave the first alone armed');
  const released = { setCrimsonSleepTimer: () => { throw Error('Released'); }, get crimsonSleepTimerExpiredAt() { throw Error('Released'); } };
  calls.length = 0;
  assert.equal(setNativeSleepDeadline([released, second], 0), false);
  assert.deepEqual(calls, [['second', 0]], 'released first deck does not prevent clearing second');
  assert.equal(nativeSleepExpired([released, second], 456), true);
});

test('native patches install once, keep cleanup and transport guards, and reject unsupported audio versions', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'crimson-sleep-plugin-'));
  const upstream = require.resolve('expo-audio/package.json').replace(/package.json$/, '');
  const moduleRoot = join(temporary, 'node_modules/expo-audio');
  const targets = ['ios/AudioPlayer.swift', 'ios/AudioModule.swift', 'android/src/main/java/expo/modules/audio/AudioPlayer.kt', 'android/src/main/java/expo/modules/audio/AudioModule.kt'];
  try {
    mkdirSync(moduleRoot, { recursive: true });
    writeFileSync(join(moduleRoot, 'package.json'), JSON.stringify({ name: 'expo-audio', version: '57.0.5', exports: { './package.json': './package.json' } }));
    for (const relative of targets) { const file = join(moduleRoot, relative); mkdirSync(file.slice(0, file.lastIndexOf('/')), { recursive: true }); writeFileSync(file, readFileSync(join(upstream, relative))); }
    patchCrimsonSleepTimer(temporary);
    const first = targets.map((relative) => readFileSync(join(moduleRoot, relative), 'utf8'));
    patchCrimsonSleepTimer(temporary);
    assert.deepEqual(targets.map((relative) => readFileSync(join(moduleRoot, relative), 'utf8')), first);
    assert.match(first[0], /sharedObjectWillRelease\(\) \{\s+setCrimsonSleepTimer\(0\)/);
    assert.match(first[0], /resumePlayback\(\) \{\s+guard !crimsonSleepTimerBlocksPlayback/);
    assert.match(first[2], /releasePlayer\(\) \{\s+setCrimsonSleepTimer\(0\.0\)/);
    assert.match(first[2], /ref\.addListener\(crimsonSleepListener\)/);
    assert.match(first[3], /if \(!player\.crimsonSleepTimerBlocksPlayback\(\)\) player\.ref\.play\(\)/);
    writeFileSync(join(moduleRoot, 'package.json'), JSON.stringify({ name: 'expo-audio', version: '99.0.0', exports: { './package.json': './package.json' } }));
    assert.throws(() => patchCrimsonSleepTimer(temporary), /review it before upgrading/);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test('actual Swift native deadline code pauses without JS and honors cancel/replacement/expiry latch', { skip: process.platform !== 'darwin' }, () => {
  const temporary = mkdtempSync(join(tmpdir(), 'crimson-sleep-swift-'));
  const native = readFileSync(new URL('../plugins/crimson-sleep-timer/AudioPlayer.swift.inc', import.meta.url), 'utf8');
  const source = `import Foundation
final class FakeAudioRef { var pauses = 0; func pause() { pauses += 1 } }
final class NativePlayer {
  let ref = FakeAudioRef()
  var wasPlaying = true
  func updateStatus(with values: [String: Any]) {}
${native}
}
func timerClock() -> Double { Date().timeIntervalSince1970 * 1000 }
func wait(_ seconds: Double) { RunLoop.main.run(until: Date().addingTimeInterval(seconds)) }
let first = NativePlayer(), second = NativePlayer()
let deadline = timerClock() + 30
first.setCrimsonSleepTimer(deadline); second.setCrimsonSleepTimer(deadline)
wait(0.08)
precondition(first.ref.pauses == 1 && second.ref.pauses == 1)
precondition(first.crimsonSleepTimerExpiredAt == deadline)
precondition(first.crimsonSleepTimerBlocksPlayback())
first.setCrimsonSleepTimer(0)
precondition(!first.crimsonSleepTimerBlocksPlayback())
let before = first.ref.pauses
first.setCrimsonSleepTimer(timerClock() + 20)
first.setCrimsonSleepTimer(timerClock() + 180)
wait(0.07)
precondition(first.ref.pauses == before)
first.setCrimsonSleepTimer(0)
wait(0.2)
precondition(first.ref.pauses == before)
first.setCrimsonSleepTimer(timerClock() - 1)
precondition(first.crimsonSleepTimerBlocksPlayback())
precondition(first.ref.pauses == before + 1)
wait(0.02)
precondition(first.ref.pauses == before + 1)
print("Native sleep timer passed")
`;
  try {
    writeFileSync(join(temporary, 'main.swift'), source);
    const compilation = spawnSync('swiftc', [join(temporary, 'main.swift'), '-o', join(temporary, 'native-test')], { encoding: 'utf8', timeout: 60_000 });
    assert.equal(compilation.status, 0, compilation.stderr);
    const result = spawnSync(join(temporary, 'native-test'), [], { encoding: 'utf8', timeout: 5_000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Native sleep timer passed/);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
