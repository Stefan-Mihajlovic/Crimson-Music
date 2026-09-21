import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/audio/crimson-peak-limiter-v1.js', import.meta.url), 'utf8');
function processor(sampleRate = 48000) {
  let Processor;
  runInNewContext(source, {
    sampleRate,
    AudioWorkletProcessor: class { port = { onmessage: null }; },
    registerProcessor(name, implementation) { assert.equal(name, 'crimson-peak-limiter-v1'); Processor = implementation; },
  });
  return new Processor();
}
function render(limiter, channels, enabled = 1) {
  const input = channels.map((values) => Float32Array.from(values));
  const output = input.map((values) => new Float32Array(values.length));
  assert.equal(limiter.process([input], [output], { enabled: Float32Array.of(enabled) }), true);
  return output;
}
const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('actual worklet leaves quiet PCM and initial Flat/off samples unchanged without delay', () => {
  const values = [0, 0.25, -0.7, 0.97, -0.2, 0];
  assert.deepEqual(render(processor(), [values])[0], Float32Array.from(values));
  const original = [1, -1, 0.3, 1.5, -1.7, 0];
  assert.deepEqual(render(processor(), [original], 0)[0], Float32Array.from(original));
});

test('overloads receive immediate linked gain on every channel, including a new peak during hold', () => {
  const limiter = processor();
  const [left, right] = render(limiter, [[2, 0.6, 4], [0.4, -0.2, 0.8]]);
  near(left[0], 0.98); near(right[0], 0.196);
  near(left[1], 0.6 * 0.49); near(right[1], -0.2 * 0.49);
  near(left[2], 0.98); near(right[2], 0.196);
  assert.ok(left.every((value) => Math.abs(value) <= 0.98000002));
});

test('30ms hold and 150ms release are sample-rate invariant across variable render quanta', () => {
  for (const sampleRate of [22050, 44100, 48000, 96000]) {
    const limiter = processor(sampleRate);
    render(limiter, [[2], [0.4]]);
    let hold = Math.ceil(sampleRate * 0.030);
    while (hold > 0) {
      const count = Math.min(hold, 97);
      const [output] = render(limiter, [new Float32Array(count).fill(0.2)]);
      output.forEach((value) => near(value, 0.2 * 0.49));
      hold -= count;
    }
    const releaseFrames = Math.round(sampleRate * 0.150);
    let rendered = 0;
    while (rendered < releaseFrames) {
      const count = Math.min(releaseFrames - rendered, 173);
      render(limiter, [new Float32Array(count).fill(0.2)]);
      rendered += count;
    }
    near(limiter.gain, 1 + (0.49 - 1) * Math.exp(-releaseFrames / (sampleRate * 0.150)), 1e-10);
  }
});

test('sustained bass retains its waveform and stereo balance without gain ripple between cycles', () => {
  const sampleRate = 48000;
  const limiter = processor(sampleRate);
  const input = Float32Array.from({ length: sampleRate / 2 }, (_, frame) => 1.5 * Math.sin(2 * Math.PI * 60 * frame / sampleRate));
  const right = Float32Array.from(input, (value) => value * 0.25);
  const [leftOutput, rightOutput] = render(limiter, [input, right]);
  for (let frame = 1600; frame < input.length; frame++) {
    near(leftOutput[frame], input[frame] * (0.98 / 1.5));
    near(rightOutput[frame], leftOutput[frame] * 0.25);
    assert.ok(Math.abs(leftOutput[frame]) <= 0.98000002);
  }
});

test('rounding at equivalent repeated peaks refreshes the hold without raising gain', () => {
  const limiter = processor();
  render(limiter, [[2]]);
  const firstGain = limiter.gain;
  render(limiter, [new Float32Array(1200).fill(0.2)]);
  render(limiter, [[1.999999]]);
  assert.equal(limiter.gain, firstGain);
  assert.equal(limiter.hold, Math.ceil(48000 * 0.030));
});

test('turning EQ off recovers ducked gain over the filter ramp, then returns exact bypass', () => {
  const limiter = processor();
  render(limiter, [[2]]);
  const samples = new Float32Array(1202).fill(0.2);
  const [output] = render(limiter, [samples], 0);
  near(output[0], 0.2 * (0.49 + 0.51 / 1200));
  for (let frame = 1; frame < 1200; frame++) assert.ok(output[frame] >= output[frame - 1]);
  assert.equal(output[1199], samples[1199]);
  assert.equal(output[1201], samples[1201]);
  assert.equal(limiter.gain, 1);
  assert.deepEqual(render(limiter, [[1, -1, 0.125]], 0)[0], Float32Array.of(1, -1, 0.125));
});

test('reenabling during the bypass ramp protects peaks and nonfinite input cannot poison the envelope', () => {
  const limiter = processor();
  render(limiter, [[2]]);
  render(limiter, [new Float32Array(100).fill(0.2)], 0);
  const [output] = render(limiter, [[4, NaN, Infinity, -Infinity, 0.2]], 1);
  near(output[0], 0.98);
  assert.deepEqual([...output.slice(1, 4)], [0, 0, 0]);
  near(output[4], 0.2 * 0.245);
  assert.equal(limiter.bypassRemaining, 0);
});

test('missing inputs output silence and disposal releases the processor', () => {
  const limiter = processor();
  const output = [new Float32Array(128).fill(1), new Float32Array(128).fill(1)];
  assert.equal(limiter.process([[]], [output], { enabled: Float32Array.of(1) }), true);
  assert.ok(output.every((channel) => channel.every((sample) => sample === 0)));
  limiter.port.onmessage({ data: { type: 'dispose' } });
  assert.equal(limiter.process([[]], [output], { enabled: Float32Array.of(1) }), false);
});
