import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import './helpers/typescript-imports.mjs';
const { WebDeckGainControl, WEB_DECK_GAIN_EXPO_VERSION, configureWebEqualizer, configureWebSleepTimer } = await import('../src/services/web-deck-gain.ts');
const { equalizerPreampDb, equalizerSafePreampDb } = await import('../src/services/equalizer-dsp.ts');

function context() {
  const ctx = {
    state: 'running', destination: {}, sources: 0, resumes: 0, sampleRate: 48000, currentTime: 2,
    resume() { this.resumes++; this.state = 'running'; return Promise.resolve(); },
    createMediaElementSource(media) { this.sources++; return node(ctx); },
    createGain() { return { ...node(ctx), gain: parameter(1) }; },
    createBiquadFilter() { return { ...node(ctx), type: 'lowpass', gain: parameter(0), frequency: parameter(350), Q: parameter(1) }; },
  };
  return ctx;
}
function parameter(value) {
  return { value, ramps: [], scheduled: [], cancelScheduledValues() { this.scheduled = []; }, setValueAtTime(value, time) { this.value = value; this.scheduled.push([value, time]); },
    linearRampToValueAtTime(value, time) { this.value = value; this.ramps.push([value, time]); } };
}
function route(player) {
  const result = [];
  let current = player.sourceNode;
  while (current?.connections) { result.push(current); current = [...current.connections][0]; }
  return result;
}
function gainFor(player) { return route(player).at(-2); }
function node(context) {
  return { context, connections: new Set(), connect(target) { this.connections.add(target); }, disconnect() { this.connections.clear(); } };
}
function deck() {
  const media = { muted: false };
  // Model Safari: writes to element.volume do nothing.
  Object.defineProperty(media, 'volume', { get: () => 1, set: () => undefined });
  return { media, sourceNode: null, analyser: null };
}

test('iOS browser attenuation uses a GainNode even when element volume ignores writes', () => {
  const ctx = context(), player = deck(), adapter = new WebDeckGainControl(() => ctx);
  adapter.set(player, 0.25);
  const gain = gainFor(player);
  assert.equal(player.media.volume, 1);
  assert.equal(gain.gain.value, 0.25);
  assert.equal(gain.connections.has(route(player).at(-1)), true);
  assert.equal(adapter.ready(player), true);
  adapter.dispose();
  assert.equal(gain.connections.size, 0);
});

test('spectrum enable and disable reuse Expo source, preserve the analyser, and restore the gain route', () => {
  const ctx = context(), player = deck(), adapter = new WebDeckGainControl(() => ctx);
  adapter.set(player, 0.5);
  const source = player.sourceNode, gain = gainFor(player), preamp = route(player)[1];
  const analyser = node(ctx);
  player.analyser = analyser;
  source.disconnect(); source.connect(analyser); analyser.connect(ctx.destination);
  adapter.set(player, 0.4);
  assert.equal(ctx.sources, 1);
  assert.equal(source.connections.has(analyser), true);
  assert.deepEqual([...analyser.connections], [preamp]);
  assert.equal(gain.gain.value, 0.4);
  player.analyser = null; source.disconnect(); source.connect(ctx.destination);
  adapter.set(player, 0.3);
  assert.deepEqual([...source.connections], [preamp]);
  assert.equal(gain.gain.value, 0.3);
  adapter.dispose();
});

test('source replacement disposes the old gain and creates exactly one source for the new element', () => {
  const ctx = context(), player = deck(), adapter = new WebDeckGainControl(() => ctx);
  adapter.set(player, 0);
  const oldGain = gainFor(player);
  player.media = deck().media; player.sourceNode = null;
  adapter.set(player, 0);
  assert.equal(oldGain.connections.size, 0);
  assert.equal(ctx.sources, 2);
  assert.equal(gainFor(player).gain.value, 0);
  adapter.dispose();
});

test('repeated sampling disable restores EQ and attenuation even when analyser identity stays null', () => {
  const ctx = context(), player = deck(), adapter = new WebDeckGainControl(() => ctx);
  adapter.set(player, 0.2);
  const chain = route(player);
  for (let call = 0; call < 3; call++) {
    // Exact Expo Audio 57 behavior for setAudioSamplingEnabled(false).
    player.sourceNode.disconnect(); player.sourceNode.connect(ctx.destination);
    adapter.samplingChanged(); adapter.set(player, 0.2);
    assert.deepEqual(route(player), chain);
    assert.equal(gainFor(player).gain.value, 0.2);
  }
  assert.equal(ctx.sources, 1);
  adapter.dispose();
});

test('standby sampling invalidation keeps the playing graph ready for crossfade', () => {
  const ctx = context(), first = deck(), second = deck(), adapter = new WebDeckGainControl(() => ctx);
  adapter.set(first, 1); adapter.set(second, 0);
  adapter.samplingChanged(second);
  assert.equal(adapter.ready(first), true);
  assert.equal(adapter.ready(second), false);
  adapter.set(second, 0);
  assert.equal(adapter.ready(second), true);
  adapter.dispose();
});

test('a failed graph mutes the standby and blocks overlap while restoring single-song audio', () => {
  const ctx = context(), player = deck(), adapter = new WebDeckGainControl(() => ctx);
  ctx.createGain = () => { throw new Error('graph unavailable'); };
  adapter.set(player, 0);
  assert.equal(adapter.ready(player), false);
  assert.equal(player.media.muted, true);
  adapter.set(player, 1);
  assert.equal(player.media.muted, false);
  assert.deepEqual([...player.sourceNode.connections], [ctx.destination]);
  adapter.dispose();
});

test('gesture unlock resumes the shared context synchronously and suspended graphs cannot overlap', () => {
  const ctx = context(), player = deck(), adapter = new WebDeckGainControl(() => ctx);
  ctx.state = 'suspended'; adapter.set(player, 1);
  assert.equal(adapter.ready(player), false);
  adapter.unlock();
  assert.equal(ctx.resumes, 1);
  assert.equal(adapter.ready(player), true);
  adapter.dispose();
});

test('Expo upgrades require reviewing the web deck private-field adapter', () => {
  const installed = JSON.parse(readFileSync(new URL('../node_modules/expo-audio/package.json', import.meta.url), 'utf8'));
  assert.equal(installed.version, WEB_DECK_GAIN_EXPO_VERSION, 'Review Expo Audio media, sourceNode, analyser, and shared AudioContext before upgrading.');
});

test('gain routing recovers after a connection failure without a silent detached output', () => {
  const ctx = context(), player = deck(), adapter = new WebDeckGainControl(() => ctx);
  adapter.set(player, 0.3);
  const gain = gainFor(player), preamp = route(player)[1], sleepGain = route(player).at(-1);
  const originalConnect = gain.connect;
  const analyser = node(ctx);
  player.analyser = analyser;
  gain.connect = () => { throw new Error('transient route failure'); };
  adapter.set(player, 0.3);
  assert.equal(adapter.ready(player), false);
  assert.equal(gain.connections.size, 0);
  gain.connect = originalConnect;
  adapter.set(player, 0.3);
  assert.equal(adapter.ready(player), true);
  assert.equal(gain.connections.has(sleepGain), true);
  assert.equal(analyser.connections.has(preamp), true);
  adapter.dispose();
});

test('EQ presets use shelves and three mid filters on both decks without changing crossfade gain', () => {
  const ctx = context(), first = deck(), second = deck(), adapter = new WebDeckGainControl(() => ctx);
  const bass = { enabled: true, preset: 'bass', bands: [7, 3, -1, 0, 0] };
  assert.equal(configureWebEqualizer([first, second], bass), true);
  adapter.set(first, 0.35); adapter.set(second, 0.65);
  for (const player of [first, second]) {
    const chain = route(player);
    assert.equal(chain.length, 9, 'source → preamp → 5 filters → crossfade gain → sleep gain');
    assert.ok(chain[1].gain.value < 0.5, 'overlapping boosted bands receive automatic headroom');
    assert.deepEqual(chain.slice(2, 7).map((filter) => filter.frequency.value), [100, 300, 1000, 4000, 10000]);
    assert.deepEqual(chain.slice(2, 7).map((filter) => filter.type), ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf']);
    assert.deepEqual(chain.slice(2, 7).map((filter) => filter.gain.value), bass.bands);
  }
  const firstChain = route(first);
  configureWebEqualizer([first, second], { ...bass, enabled: false });
  assert.deepEqual(route(first), firstChain, 'preset changes never reconnect or recreate the graph');
  assert.equal(firstChain[1].gain.value, 1);
  assert.ok(firstChain.slice(2, 7).every((filter) => filter.gain.value === 0 && filter.gain.ramps.at(-1)[1] === 2.025));
  assert.equal(gainFor(first).gain.value, 0.35);
  assert.equal(gainFor(second).gain.value, 0.65);
  assert.equal(ctx.sources, 2, 'exactly one MediaElementSource per deck');
  adapter.dispose();
});

test('sleep deadline is scheduled on the audio clock of both decks and survives crossfade/EQ updates and source replacement', (t) => {
  t.mock.method(Date, 'now', () => 100000);
  const ctx = context(), first = deck(), second = deck(), adapter = new WebDeckGainControl(() => ctx);
  configureWebSleepTimer([first, second], 160000);
  adapter.set(first, 1); adapter.set(second, 0);
  const sleepGain = route(first).at(-1);
  assert.deepEqual(sleepGain.gain.scheduled, [[1, 2], [0, 62]]);
  assert.deepEqual(route(second).at(-1).gain.scheduled, [[1, 2], [0, 62]]);
  adapter.set(first, 0.2); adapter.set(second, 0.8);
  configureWebEqualizer([first, second], { enabled: true, preset: 'flat', bands: [0, 0, 0, 0, 0] });
  assert.deepEqual(sleepGain.gain.scheduled, [[1, 2], [0, 62]], 'volume and preset changes cannot unmute a deadline');
  first.media = deck().media; first.sourceNode = null;
  adapter.set(first, 0.2);
  assert.deepEqual(route(first).at(-1).gain.scheduled, [[1, 2], [0, 62]]);
  configureWebSleepTimer([first, second], 0);
  assert.deepEqual(route(first).at(-1).gain.scheduled, [[1, 2]]);
  configureWebSleepTimer([first, second], 90000);
  assert.deepEqual(route(first).at(-1).gain.scheduled, [[0, 2]]);
  adapter.dispose();
});

function workletContext(t) {
  const ctx = context();
  let resolveModule, rejectModule;
  ctx.modules = [];
  ctx.worklets = [];
  ctx.audioWorklet = { addModule(url) {
    ctx.modules.push(url);
    return new Promise((resolve, reject) => { resolveModule = resolve; rejectModule = reject; });
  } };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'AudioWorkletNode');
  Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, value: class {
    constructor(context, name, options) {
      assert.equal(name, 'crimson-peak-limiter-v1');
      assert.equal(options.channelCountMode, 'max');
      const result = {
        ...node(context), parameters: new Map([['enabled', parameter(options.parameterData.enabled)]]),
        onprocessorerror: null, port: { messages: [], closed: false, postMessage(message) { this.messages.push(message); }, close() { this.closed = true; } },
      };
      context.worklets.push(result);
      return result;
    }
  } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'AudioWorkletNode', previous); else delete globalThis.AudioWorkletNode; });
  return { ctx, async ready() { resolveModule(); await new Promise((resolve) => setImmediate(resolve)); }, async fail() { rejectModule(new Error('Worklet unavailable')); await new Promise((resolve) => setImmediate(resolve)); } };
}
const bass = { enabled: true, preset: 'bass', bands: [7, 3, -1, 0, 0] };

test('one worklet module per context protects both decks before increasing EQ gain, with base-path deployment support', async (t) => {
  const { ctx, ready } = workletContext(t);
  const originalPrefix = process.env.EXPO_BASE_URL;
  process.env.EXPO_BASE_URL = '/crimson/';
  t.after(() => { if (originalPrefix === undefined) delete process.env.EXPO_BASE_URL; else process.env.EXPO_BASE_URL = originalPrefix; });
  const first = deck(), second = deck(), adapter = new WebDeckGainControl(() => ctx);
  configureWebEqualizer([first, second], bass);
  configureWebSleepTimer([first, second], Date.now() + 60000);
  adapter.set(first, 0.3); adapter.set(second, 0.7);
  const firstChain = route(first), secondChain = route(second);
  const sleepSchedule = [...firstChain.at(-1).gain.scheduled];
  assert.equal(firstChain[1].gain.value, 10 ** (equalizerSafePreampDb(bass.bands, 48000) / 20));
  assert.deepEqual(ctx.modules, ['/crimson/audio/crimson-peak-limiter-v1.js']);
  await ready();
  assert.equal(ctx.worklets.length, 2);
  for (const player of [first, second]) {
    const chain = route(player);
    assert.equal(chain.length, 10, 'source → preamp → shelves/mids → linked limiter → crossfade → sleep');
    assert.equal(chain[1].gain.value, 10 ** (equalizerPreampDb(bass.bands) / 20));
    assert.ok(ctx.worklets.includes(chain[7]));
    assert.equal(chain[7].parameters.get('enabled').value, 1);
  }
  assert.equal(gainFor(first).gain.value, 0.3);
  assert.equal(gainFor(second).gain.value, 0.7);
  assert.equal(route(second).at(-1), secondChain.at(-1));
  assert.deepEqual(route(first).at(-1).gain.scheduled, sleepSchedule);
  const withLimiter = route(first);
  configureWebEqualizer([first, second], { ...bass, enabled: false });
  assert.deepEqual(route(first), withLimiter);
  assert.equal(withLimiter[7].parameters.get('enabled').value, 0);
  assert.equal(withLimiter[1].gain.value, 1);
  assert.equal(gainFor(first).gain.value, 0.3);
  adapter.dispose();
  assert.ok(ctx.worklets.every((limiter) => limiter.port.closed && limiter.connections.size === 0));
});

test('failed worklet loading retains conservative EQ and does not retry or remove sleep/crossfade gates', async (t) => {
  const { ctx, fail } = workletContext(t);
  const player = deck(), adapter = new WebDeckGainControl(() => ctx);
  configureWebEqualizer([player], bass);
  adapter.set(player, 0.4);
  const initial = route(player);
  await fail();
  adapter.set(player, 0.2);
  configureWebEqualizer([player], { ...bass, bands: [9, 2, -2, 1, 0], preset: 'custom' });
  assert.deepEqual(route(player), initial);
  assert.equal(initial[1].gain.value, 10 ** (equalizerSafePreampDb([9, 2, -2, 1, 0], 48000) / 20));
  assert.equal(gainFor(player).gain.value, 0.2);
  assert.equal(ctx.modules.length, 1);
  assert.equal(ctx.worklets.length, 0);
  adapter.dispose();
});

test('late worklet loading cannot resurrect replaced sources or disposed owners', async (t) => {
  const { ctx, ready } = workletContext(t);
  const replaced = deck(), disposed = deck(), adapter = new WebDeckGainControl(() => ctx), other = new WebDeckGainControl(() => ctx);
  configureWebEqualizer([replaced, disposed], bass);
  adapter.set(replaced, 1); other.set(disposed, 1);
  const oldChain = route(replaced);
  replaced.media = deck().media; replaced.sourceNode = null;
  adapter.set(replaced, 0.6);
  other.dispose();
  await ready();
  assert.equal(ctx.modules.length, 1);
  assert.equal(ctx.worklets.length, 1);
  assert.equal(oldChain[1].connections.size, 0);
  assert.equal(gainFor(replaced).gain.value, 0.6);
  assert.equal(other.ready(disposed), false);
  adapter.dispose();
});

test('processor errors restore headroom before bypassing only the limiter and preserve the sleep deadline', async (t) => {
  const { ctx, ready } = workletContext(t);
  const player = deck(), adapter = new WebDeckGainControl(() => ctx);
  configureWebEqualizer([player], bass);
  configureWebSleepTimer([player], Date.now() + 10000);
  adapter.set(player, 0.25);
  await ready();
  const chain = route(player), limiter = ctx.worklets[0], sleep = chain.at(-1);
  const scheduled = [...sleep.gain.scheduled];
  limiter.onprocessorerror();
  assert.equal(route(player).length, 9);
  assert.equal(chain[1].gain.value, 10 ** (equalizerSafePreampDb(bass.bands, 48000) / 20));
  assert.equal(gainFor(player).gain.value, 0.25);
  assert.deepEqual(sleep.gain.scheduled, scheduled);
  assert.equal(limiter.port.closed, true);
  assert.equal(limiter.connections.size, 0);
  adapter.set(player, 0.35);
  assert.equal(ctx.worklets.length, 1);
  assert.equal(adapter.ready(player), true);
  adapter.dispose();
});

test('sampling reconnects preserve a live limiter and deferred loading can recover after invalidation', async (t) => {
  const { ctx, ready } = workletContext(t);
  const player = deck(), adapter = new WebDeckGainControl(() => ctx);
  configureWebEqualizer([player], bass);
  adapter.set(player, 0.4);
  adapter.samplingChanged(player);
  await ready();
  assert.equal(ctx.worklets.length, 0);
  adapter.set(player, 0.4);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ctx.worklets.length, 1);
  const protectedChain = route(player);
  player.sourceNode.disconnect(); player.sourceNode.connect(ctx.destination);
  adapter.samplingChanged(player); adapter.set(player, 0.6);
  assert.deepEqual(route(player), protectedChain);
  assert.equal(ctx.worklets.length, 1);
  assert.equal(gainFor(player).gain.value, 0.6);
  adapter.dispose();
});
