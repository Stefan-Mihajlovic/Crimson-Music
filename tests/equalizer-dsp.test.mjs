import assert from 'node:assert/strict';
import { test } from 'node:test';
import './helpers/typescript-imports.mjs';
const { equalizerPreampDb, equalizerSafePreampDb, equalizerResponseDb } = await import('../src/services/equalizer-dsp.ts');
const { applyEqualizer } = await import('../src/services/equalizer-platform.ts');
const { EQUALIZER_PRESETS, EQUALIZER_FREQUENCIES } = await import('../src/services/equalizer.ts');

test('shelves cover bass and treble while middle filters retain their center boost and cut', () => {
  for (const sampleRate of [22050, 44100, 48000, 96000, 192000]) {
    EQUALIZER_FREQUENCIES.forEach((frequency, index) => {
      for (const gain of [-12, -6, 6, 12]) {
        const bands = [0, 0, 0, 0, 0]; bands[index] = gain;
        const center = Math.min(frequency, sampleRate * 0.45);
        const expected = index === 0 || index === 4 ? gain / 2 : gain;
        assert.ok(Math.abs(equalizerResponseDb(bands, center, sampleRate) - expected) < 1e-5);
      }
    });
    assert.ok(Math.abs(equalizerResponseDb([6, 0, 0, 0, 0], 15, sampleRate) - 6) < 0.01);
    assert.ok(Math.abs(equalizerResponseDb([0, 0, 0, 0, 6], sampleRate * 0.499, sampleRate) - 6) < 0.01);
  }
});

test('factory curves keep modest broadband trim and Bass boost raises actual bass relative to Flat', () => {
  for (const preset of EQUALIZER_PRESETS) {
    const preamp = equalizerPreampDb(preset.bands);
    assert.ok(preamp >= -1.4 && preamp <= 0, `${preset.id}: excessive broadband cut ${preamp}`);
    for (const frequency of [20, 100, 1000, 5000, 20000]) {
      if (preset.id === 'flat') assert.ok(Math.abs(equalizerResponseDb(preset.bands, frequency) + preamp) < 1e-8);
    }
  }
  const bass = EQUALIZER_PRESETS.find((preset) => preset.id === 'bass').bands;
  const net = (frequency) => equalizerResponseDb(bass, frequency) + equalizerPreampDb(bass);
  assert.ok(net(40) > 5);
  assert.ok(net(80) > 3.5);
  assert.ok(net(100) > 2.5);
  assert.ok(net(1000) > -2, 'boosting bass must not mute the rest of the song');
  assert.equal(equalizerPreampDb([12, 12, 12, 12, 12]), -2);
});

test('web fallback headroom protects the combined response when a limiter is unavailable', () => {
  for (const bands of [[12, 12, 12, 12, 12], [12, -12, 12, -12, 12], [6, 4, 0, -1, 0]]) {
    const preamp = equalizerSafePreampDb(bands);
    for (const sampleRate of [22050, 32000, 44100, 48000, 96000, 192000]) {
      for (let i = 0; i <= 1024; i++) {
        const frequency = 10 * (sampleRate / 20) ** (i / 1024);
        assert.ok(equalizerResponseDb(bands, frequency, sampleRate) + preamp < -0.9);
      }
    }
  }
  assert.equal(equalizerPreampDb([0, 0, 0, 0, 0]), 0);
  assert.equal(equalizerPreampDb([-12, -6, 0, -3, -2]), 0);
});

test('native adapter prepares both decks even while disabled, reports unsupported builds and never touches sampling', () => {
  const calls = [];
  const first = { setCrimsonEqualizer: (...args) => { calls.push(['first', ...args]); return true; }, setAudioSamplingEnabled() { throw new Error('must not touch taps'); } };
  const second = { setCrimsonEqualizer: (...args) => { calls.push(['second', ...args]); return true; } };
  const settings = { enabled: false, preset: 'bass', bands: [...EQUALIZER_PRESETS.find((preset) => preset.id === 'bass').bands] };
  assert.equal(applyEqualizer([first, second, first], settings), true);
  assert.deepEqual(calls, [['first', false, settings.bands, 0], ['second', false, settings.bands, 0]]);
  assert.equal(applyEqualizer([first, {}], settings), false);
  assert.equal(applyEqualizer([{ setCrimsonEqualizer: () => false }], settings), false);
});
