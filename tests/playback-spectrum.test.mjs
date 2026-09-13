import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAUSED_SPECTRUM, PlaybackSpectrumAnalyzer } from '../src/services/playback-spectrum.ts';

const frames = (bin, amplitude = 0.5, size = 512) => Array.from({ length: size }, (_, index) => amplitude * Math.sin(2 * Math.PI * bin * index / size));
const sample = (bin, amplitude = 0.5) => ({ channels: [{ frames: frames(bin, amplitude) }] });

test('bass, lower mids, upper mids, and treble move separate bars from real PCM', () => {
  [2, 8, 32, 128].forEach((bin, band) => {
    const levels = new PlaybackSpectrumAnalyzer().analyze(sample(bin));
    assert.ok(levels[band] > 0.9, `band ${band} responds on the first audio sample`);
    levels.forEach((level, index) => {
      if (index !== band) assert.ok(level < 0.25, `unrelated band ${index} stays low`);
    });
  });
});

test('a real transient attacks immediately and falls visibly after the sound stops', () => {
  const analyzer = new PlaybackSpectrumAnalyzer();
  for (let index = 0; index < 8; index += 1) analyzer.analyze(sample(2, 0.005));
  const quiet = analyzer.analyze(sample(2, 0.005));
  const hit = analyzer.analyze(sample(2, 0.8));
  assert.ok(quiet[0] < 0.1);
  assert.ok(hit[0] > 0.9);
  assert.ok(hit[0] - quiet[0] > 0.8);
  analyzer.analyze(sample(2, 0));
  analyzer.analyze(sample(2, 0));
  const decay = analyzer.analyze(sample(2, 0));
  assert.ok(decay[0] < 0.25, 'the peak has fallen substantially within 150ms');
});

test('shared gain preserves the balance between louder bass and quieter treble', () => {
  const bass = frames(2, 0.5);
  const treble = frames(128, 0.04);
  const mixed = { channels: [{ frames: bass.map((value, index) => value + treble[index]) }] };
  const analyzer = new PlaybackSpectrumAnalyzer();
  let levels;
  for (let index = 0; index < 30; index += 1) levels = analyzer.analyze(mixed);
  assert.ok(levels[0] > 0.9);
  assert.ok(levels[3] > 0.1 && levels[3] < 0.3, 'quiet treble is not independently boosted to full height');
});

test('opposite-phase stereo remains visible instead of cancelling during channel mixing', () => {
  const mono = sample(32);
  const stereo = { channels: [mono.channels[0], { frames: mono.channels[0].frames.map((value) => -value) }] };
  const expected = new PlaybackSpectrumAnalyzer().analyze(mono);
  const actual = new PlaybackSpectrumAnalyzer().analyze(stereo);
  actual.forEach((level, index) => assert.ok(Math.abs(level - expected[index]) < 1e-8));
});

test('silence, DC offsets, and invalid input never manufacture dancing bars', () => {
  const analyzer = new PlaybackSpectrumAnalyzer();
  assert.equal(analyzer.analyze({ channels: [] }), null);
  assert.equal(analyzer.analyze({ channels: [{ frames: [1, -1] }] }), null);
  for (const value of [0, 0.7, Number.NaN, Number.POSITIVE_INFINITY]) {
    let levels;
    for (let index = 0; index < 20; index += 1) levels = analyzer.analyze({ channels: [{ frames: Array(512).fill(value) }] });
    assert.deepEqual(levels, [0.06, 0.06, 0.06, 0.06]);
  }
});

test('constant audio settles instead of following an invented looping animation', () => {
  const analyzer = new PlaybackSpectrumAnalyzer();
  let settled;
  for (let index = 0; index < 30; index += 1) settled = analyzer.analyze(sample(8));
  for (let index = 0; index < 30; index += 1) assert.deepEqual(analyzer.analyze(sample(8)), settled);
});

test('analysis uses the most recent bounded frame window and resets between playback sessions', () => {
  const recent = frames(8);
  const analyzer = new PlaybackSpectrumAnalyzer();
  const reference = new PlaybackSpectrumAnalyzer().analyze({ channels: [{ frames: recent }] });
  const long = analyzer.analyze({ channels: [{ frames: [...Array(100_000).fill(0), ...recent] }] });
  assert.deepEqual(long, reference);
  assert.notDeepEqual(long, PAUSED_SPECTRUM);
  analyzer.analyze(sample(128, 0.9));
  analyzer.reset();
  assert.deepEqual(analyzer.analyze({ channels: [{ frames: recent }] }), reference);
});
