import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { patchAndroidMedia, patchAudioPlayerSampling } = require('../plugins/with-android-media-controls.js');
const marker = '// Crimson Android media adapter v1';
// Relevant upstream anchors plus sentinel playback code that the sampling patch must preserve.
const upstreamPlayer = `package expo.modules.audio
import android.Manifest
import android.content.pm.PackageManager
import android.media.audiofx.Visualizer
import android.util.Log
import androidx.core.content.ContextCompat
class AudioPlayer(
  bufferDurationMs: Long = 0
) : BaseAudioPlayer(
  player = ExoPlayer.Builder(context)
    .setAudioAttributes(AudioAttributes.DEFAULT, false)
    .setSeekForwardIncrementMs(SEEK_JUMP_INTERVAL_MS)
    .build()
) {
  private var samplingEnabled = false
  private var visualizer: Visualizer? = null
  init {
    installPlayerListeners()
    source?.let { setMediaSource(it) }
  }
  fun setSamplingEnabled(enabled: Boolean) {
    checkPermission(Manifest.permission.RECORD_AUDIO)
    createVisualizer()
  }
  override fun setPlaybackRate(rate: Float) { preservePlaybackRate(rate) }
  private fun extractAmplitudes(chunk: ByteArray) = chunk.map { it.toFloat() }
  override fun currentStatus() = existingPlaybackStatus()
  private fun sendAudioSampleUpdate(sample: List<Float>) {
    val body = mapOf(
      "channels" to listOf(
        mapOf("frames" to sample)
      ),
      "timestamp" to ref.currentPosition
    )
    emit(AUDIO_SAMPLE_UPDATE, body)
  }
  private fun createVisualizer() { visualizer = Visualizer(ref.audioSessionId) }
  override fun sharedObjectDidRelease() { serviceConnection.release() }
  override fun releasePlayer() {
    mediaSession.release()
    visualizer?.release()
    super.releasePlayer()
  }
}`;

function project(t, { version = '57.0.5', sourceAudio = true, player = upstreamPlayer } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'crimson-audio-plugin-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ expo: { autolinking: { android: { buildFromSource: sourceAudio ? ['expo-audio'] : [] } } } }));
  const dependency = path.join(root, 'node_modules/expo-audio');
  const sources = path.join(dependency, 'android/src/main/java/expo/modules/audio');
  fs.mkdirSync(path.join(sources, 'service'), { recursive: true });
  fs.writeFileSync(path.join(dependency, 'package.json'), JSON.stringify({ name: 'expo-audio', version }));
  fs.writeFileSync(path.join(sources, 'AudioPlayer.kt'), player);
  for (const file of ['AudioModule.kt', 'service/MetadataInjectingPlayer.kt', 'service/AudioMediaSessionCallback.kt', 'service/AudioControlsService.kt']) {
    fs.writeFileSync(path.join(sources, file), `${marker}\n// Existing media controls stay unchanged.\n`);
  }
  return { root, sources };
}

test('PCM sampling replaces the permission-gated Visualizer while preserving playback and event identity', () => {
  const patched = patchAudioPlayerSampling(upstreamPlayer);
  assert.doesNotMatch(patched, /Visualizer|RECORD_AUDIO|checkPermission|extractAmplitudes/);
  for (const preserved of [
    '.setAudioAttributes(AudioAttributes.DEFAULT, false)', '.setSeekForwardIncrementMs(SEEK_JUMP_INTERVAL_MS)',
    'source?.let { setMediaSource(it) }', 'preservePlaybackRate(rate)', 'existingPlaybackStatus()',
    '"timestamp" to ref.currentPosition', 'emit(AUDIO_SAMPLE_UPDATE, body)', 'serviceConnection.release()',
    'mediaSession.release()', 'super.releasePlayer()',
  ]) assert.ok(patched.includes(preserved), `preserves ${preserved}`);
  assert.equal((patched.match(/ExoPlayer\.Builder\(/g) || []).length, 1);
  assert.match(patched, /if \(ref\.isPlaying\) sendAudioSampleUpdate\(channels\)/);
  assert.match(patched, /crimsonSamples\.release\(\)/);
});

test('reapplying the plugin is idempotent and copies canonical PCM sources into Expo Audio', (t) => {
  const { root, sources } = project(t);
  patchAndroidMedia(root);
  const files = ['AudioPlayer.kt', 'AudioModule.kt', 'CrimsonPcmSamples.kt', 'CrimsonAudioSampleSink.kt'];
  const first = files.map((file) => fs.readFileSync(path.join(sources, file), 'utf8'));
  patchAndroidMedia(root);
  assert.deepEqual(files.map((file) => fs.readFileSync(path.join(sources, file), 'utf8')), first);
  for (const file of ['CrimsonPcmSamples.kt', 'CrimsonAudioSampleSink.kt']) {
    assert.equal(fs.readFileSync(path.join(sources, file), 'utf8'), fs.readFileSync(new URL(`../plugins/crimson-android-media/${file}`, import.meta.url), 'utf8'));
  }
});

test('an unsupported Expo version aborts before dependency writes', (t) => {
  const { root, sources } = project(t, { version: '58.0.0' });
  assert.throws(() => patchAndroidMedia(root), /supports expo-audio 57\.0\.5/);
  assert.equal(fs.readFileSync(path.join(sources, 'AudioPlayer.kt'), 'utf8'), upstreamPlayer);
  assert.equal(fs.existsSync(path.join(sources, 'CrimsonAudioSampleSink.kt')), false);
});

test('prebuilt Expo Audio configuration is refused instead of silently shipping static bars', (t) => {
  const { root, sources } = project(t, { sourceAudio: false });
  assert.throws(() => patchAndroidMedia(root), /buildFromSource/);
  assert.equal(fs.readFileSync(path.join(sources, 'AudioPlayer.kt'), 'utf8'), upstreamPlayer);
});

test('an upstream source anchor change aborts before any source or helper is written', (t) => {
  const altered = upstreamPlayer.replace('  bufferDurationMs: Long = 0\n', '  changedBuffer: Long = 0\n');
  const { root, sources } = project(t, { player: altered });
  assert.throws(() => patchAndroidMedia(root), /upstream player sample sink changed/);
  assert.equal(fs.readFileSync(path.join(sources, 'AudioPlayer.kt'), 'utf8'), altered);
  assert.equal(fs.existsSync(path.join(sources, 'CrimsonAudioSampleSink.kt')), false);
});
