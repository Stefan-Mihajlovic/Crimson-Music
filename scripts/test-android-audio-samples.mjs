import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Standalone Kotlin checks against the project's cached Media3 APIs; never starts Gradle.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(process.env.GRADLE_USER_HOME || path.join(os.homedir(), '.gradle'), 'caches/modules-2/files-2.1');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'crimson-pcm-tests-'));
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin/java') : 'java';

function artifact(group, name, version, extension = 'jar') {
  const directory = path.join(cache, group, name, version);
  for (const hash of fs.readdirSync(directory)) {
    const candidate = path.join(directory, hash, `${name}-${version}.${extension}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Build Android once to cache ${name} ${version} before running this check.`);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.status})`);
}

try {
  const kotlin = (name) => artifact('org.jetbrains.kotlin', name, '2.1.20');
  const stdlib = kotlin('kotlin-stdlib');
  const annotations = artifact('org.jetbrains', 'annotations', '23.0.0');
  const compiler = [
    kotlin('kotlin-compiler-embeddable'), stdlib, kotlin('kotlin-script-runtime'), kotlin('kotlin-reflect'), annotations,
    artifact('org.jetbrains.intellij.deps', 'trove4j', '1.0.20200330'),
    artifact('org.jetbrains.kotlinx', 'kotlinx-coroutines-core-jvm', '1.8.0'),
  ];
  const media = ['media3-common', 'media3-exoplayer'].map((name) => {
    const result = spawnSync('unzip', ['-p', artifact('androidx.media3', name, '1.9.0', 'aar'), 'classes.jar'], { maxBuffer: 16 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`Could not read cached ${name}`);
    const target = path.join(out, `${name}.jar`);
    fs.writeFileSync(target, result.stdout);
    return target;
  });
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(root, '.build/android-toolchain/sdk');
  const platforms = fs.readdirSync(path.join(sdk, 'platforms')).filter((name) => /^android-\d+$/.test(name)).sort((a, b) => Number(b.slice(8)) - Number(a.slice(8)));
  const android = path.join(sdk, 'platforms', platforms[0], 'android.jar');
  const classpath = [stdlib, annotations, ...media, android].join(path.delimiter);
  const result = path.join(out, 'tests.jar');
  run(java, ['-cp', compiler.join(path.delimiter), 'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect', '-jvm-target', '17', '-classpath', classpath, '-d', result,
    path.join(root, 'plugins/crimson-android-media/CrimsonPcmSamples.kt'),
    path.join(root, 'plugins/crimson-android-media/CrimsonAudioSampleSink.kt'),
    path.join(root, 'tests/native/audio-samples/AndroidOs.kt'),
    path.join(root, 'tests/native/audio-samples/CrimsonAudioSamplesTest.kt'),
  ]);
  run(java, ['-cp', [result, classpath].join(path.delimiter), 'expo.modules.audio.CrimsonAudioSamplesTestKt']);
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}
