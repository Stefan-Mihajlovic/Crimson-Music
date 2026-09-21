import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CrossfadePlayer, crossfadeWindow, normalizeCrossfadeSeconds } from '../src/services/crossfade-player.ts';

function deck(id) {
  return {
    id, volume: 1, currentTime: 0, duration: 120, isLoaded: true, isBuffering: false,
    playing: false, isAudioSamplingSupported: true, source: null, listeners: new Map(),
    play() { this.playing = true; },
    pause() { this.playing = false; },
    replace(source) { this.source = source; this.currentTime = 0; },
    seekTo(position) { this.currentTime = position; return Promise.resolve(); },
    setAudioSamplingEnabled(value) { this.sampling = value; },
    addListener(event, handler) {
      this.listeners.set(event, handler);
      return { remove: () => this.listeners.delete(event) };
    },
  };
}

test('overlap plays both decks and follows media time to finish on the incoming song', () => {
  const first = deck(1), second = deck(2);
  const mixer = new CrossfadePlayer(first, second);
  try {
    mixer.player.play();
    assert.equal(mixer.prepare('next', { uri: 'file:///next.mp3' }), true);
    assert.equal(second.volume, 0);
    assert.equal(second.playing, false);
    const facade = mixer.player;
    assert.equal(mixer.begin('next', 6), true);
    assert.equal(first.playing && second.playing, true);
    assert.equal(mixer.player, facade, 'provider retains one stable player lifetime');
    assert.equal(mixer.player.id, 2);
    second.currentTime = 3;
    mixer.tick();
    assert.equal(first.volume, 0.5);
    assert.equal(second.volume, 0.5);
    second.currentTime = 6;
    mixer.tick();
    assert.equal(first.playing, false);
    assert.equal(first.volume, 0);
    assert.equal(second.volume, 1);
    assert.equal(mixer.isTransitioning, false);
  } finally { mixer.dispose(); }
});

test('pause freezes both songs and gains; resume continues the same transition', () => {
  const first = deck(1), second = deck(2);
  const mixer = new CrossfadePlayer(first, second);
  try {
    first.play();
    mixer.prepare('next', 'next');
    mixer.begin('next', 4);
    second.currentTime = 1;
    mixer.tick();
    mixer.player.pause();
    mixer.tick();
    assert.equal(first.playing || second.playing, false);
    assert.deepEqual([first.volume, second.volume], [0.75, 0.25]);
    mixer.player.play();
    assert.equal(first.playing && second.playing, true);
  } finally { mixer.dispose(); }
});

test('volume changes during overlap scale both decks without a jump to full volume', () => {
  const first = deck(1), second = deck(2);
  const mixer = new CrossfadePlayer(first, second);
  try {
    mixer.prepare('next', 'next');
    mixer.begin('next', 4);
    second.currentTime = 2;
    mixer.player.volume = 0.6;
    assert.deepEqual([first.volume, second.volume], [0.3, 0.3]);
    assert.equal(mixer.player.volume, 0.6);
  } finally { mixer.dispose(); }
});

test('seek ends the old tail and seeks only the current song', async () => {
  const first = deck(1), second = deck(2);
  const mixer = new CrossfadePlayer(first, second);
  try {
    first.currentTime = 115;
    mixer.prepare('next', 'next');
    mixer.begin('next', 4);
    await mixer.player.seekTo(30);
    assert.equal(first.currentTime, 115);
    assert.equal(first.playing, false);
    assert.equal(second.currentTime, 30);
    assert.equal(second.volume, 1);
    assert.equal(mixer.isTransitioning, false);
  } finally { mixer.dispose(); }
});

test('manual source replacement cancels an overlap and a stale preload cannot start', () => {
  const first = deck(1), second = deck(2);
  const mixer = new CrossfadePlayer(first, second);
  try {
    mixer.prepare('next', 'next');
    mixer.begin('next', 4);
    mixer.player.replace('selected');
    assert.equal(first.playing, false);
    assert.equal(second.source, 'selected');
    assert.equal(second.volume, 1);
    assert.equal(mixer.begin('next', 4), false);
    mixer.prepare('replacement', 'replacement');
    mixer.clearPrepared('old-key');
    assert.equal(mixer.ready('replacement'), true);
    mixer.clearPrepared('replacement');
    assert.equal(mixer.ready('replacement'), false);
  } finally { mixer.dispose(); }
});

test('unloaded or buffering next tracks fall back without touching current playback', () => {
  const first = deck(1), second = deck(2);
  const mixer = new CrossfadePlayer(first, second);
  try {
    first.play();
    mixer.prepare('next', 'next');
    second.isLoaded = false;
    assert.equal(mixer.begin('next', 4), false);
    second.isLoaded = true;
    second.isBuffering = true;
    assert.equal(mixer.begin('next', 4), false);
    assert.equal(first.playing, true);
    assert.equal(first.volume, 1);
  } finally { mixer.dispose(); }
});

test('sampling subscriptions follow the new deck and can be removed after a handoff', () => {
  const first = deck(1), second = deck(2);
  const mixer = new CrossfadePlayer(first, second);
  try {
    const received = [];
    const subscription = mixer.player.addListener('audioSampleUpdate', (value) => received.push(value));
    mixer.player.setAudioSamplingEnabled(true);
    first.listeners.get('audioSampleUpdate')('first');
    second.listeners.get('audioSampleUpdate')('silent');
    mixer.prepare('next', 'next');
    mixer.begin('next', 4);
    first.listeners.get('audioSampleUpdate')('tail');
    second.listeners.get('audioSampleUpdate')('second');
    assert.deepEqual(received, ['first', 'second']);
    assert.equal(first.sampling, true, 'the outgoing iOS audio tap stays attached until the deck is idle');
    assert.equal(second.sampling, true);
    subscription.remove();
    assert.equal(first.listeners.has('audioSampleUpdate') || second.listeners.has('audioSampleUpdate'), false);
  } finally { mixer.dispose(); }
});

test('invalid duration settings are bounded and short songs retain audible solo time', () => {
  assert.equal(normalizeCrossfadeSeconds(undefined), 0);
  assert.equal(normalizeCrossfadeSeconds(NaN), 0);
  assert.equal(normalizeCrossfadeSeconds(Infinity), 0);
  assert.equal(normalizeCrossfadeSeconds(-4), 0);
  assert.equal(normalizeCrossfadeSeconds(20), 12);
  assert.equal(crossfadeWindow(12, 180, 8), 4);
  assert.equal(crossfadeWindow(6, 0, 180), 0);
  assert.equal(crossfadeWindow(0, 180, 180), 0);
});


test('native lock-screen pause and resume control both overlapping songs', () => {
  const first = deck(1), second = deck(2);
  const mixer = new CrossfadePlayer(first, second);
  try {
    first.play(); mixer.prepare('next', 'next'); mixer.begin('next', 4);
    second.currentTime = 1; mixer.tick();
    second.pause(); // System controls only know Expo's active native deck.
    second.listeners.get('playbackStatusUpdate')({ playing: false });
    assert.equal(first.playing, false);
    assert.deepEqual([first.volume, second.volume], [0.75, 0.25]);
    second.play();
    second.listeners.get('playbackStatusUpdate')({ playing: true });
    assert.equal(first.playing, true);
    second.currentTime = 4; mixer.tick();
    assert.equal(mixer.isTransitioning, false);
  } finally { mixer.dispose(); }
});

test('an incoming buffer stall preserves audible outgoing audio while its fade gain freezes', () => {
  const first = deck(1), second = deck(2);
  const mixer = new CrossfadePlayer(first, second);
  try {
    first.play(); mixer.prepare('next', 'next'); mixer.begin('next', 4);
    second.currentTime = 1; mixer.tick();
    second.isBuffering = true; mixer.tick();
    assert.equal(first.playing, true);
    assert.deepEqual([first.volume, second.volume], [0.75, 0.25]);
    second.isBuffering = false; mixer.tick();
    assert.equal(first.playing, true);
    assert.deepEqual([first.volume, second.volume], [0.75, 0.25]);
  } finally { mixer.dispose(); }
});

test('spectrum taps are prepared before playback and never reconfigured on either audible deck at handoff', () => {
  const first = deck(1), second = deck(2);
  const audibleReconfigurations = [];
  for (const audio of [first, second]) {
    audio.setAudioSamplingEnabled = function (enabled) {
      if (this.sampling !== enabled && this.playing) {
        audibleReconfigurations.push(this.id);
        this.isBuffering = true; // AVPlayer must rebuild the item's audioMix.
      }
      this.sampling = enabled;
    };
  }
  const mixer = new CrossfadePlayer(first, second);
  try {
    mixer.player.setAudioSamplingEnabled(true);
    first.play();
    mixer.prepare('next', 'next');
    assert.equal(second.sampling, true);
    assert.equal(mixer.begin('next', 3), true);
    assert.deepEqual(audibleReconfigurations, []);
    assert.equal(first.playing && second.playing, true);
    assert.equal(first.isBuffering || second.isBuffering, false);
  } finally { mixer.dispose(); }
});

test('native resume restarts fade progression after an in-app pause stopped the timer', () => {
  const first = deck(1), second = deck(2);
  const mixer = new CrossfadePlayer(first, second);
  try {
    first.play(); mixer.prepare('next', 'next'); mixer.begin('next', 4);
    mixer.player.pause();
    second.play(); second.listeners.get('playbackStatusUpdate')({ playing: true });
    assert.equal(first.playing, true);
    second.currentTime = 2; mixer.tick();
    assert.deepEqual([first.volume, second.volume], [0.5, 0.5]);
  } finally { mixer.dispose(); }
});

test('loss of the required gain graph ends overlap before falling back to single-deck volume', () => {
  const first = deck(1), second = deck(2);
  let ready = true;
  const gain = { set: (player, value) => { player.volume = value; }, ready: () => ready, dispose() {} };
  const mixer = new CrossfadePlayer(first, second, gain);
  try {
    first.play(); mixer.prepare('next', 'next'); assert.equal(mixer.begin('next', 4), true);
    ready = false; second.currentTime = 1; mixer.tick();
    assert.equal(mixer.isTransitioning, false);
    assert.equal(first.playing, false);
    assert.equal(second.volume, 1);
  } finally { mixer.dispose(); }
});

test('sampling changes invalidate the web graph after both Expo calls and restore gains, including repeated false', () => {
  const first = deck(1), second = deck(2), events = [];
  for (const player of [first, second]) player.setAudioSamplingEnabled = (enabled) => events.push(`sample:${player.id}:${enabled}`);
  const gain = {
    set: (player, value) => events.push(`gain:${player.id}:${value}`),
    samplingChanged: () => events.push('graph invalidated'), dispose() {},
  };
  const mixer = new CrossfadePlayer(first, second, gain);
  try {
    for (const enabled of [true, false, false, true, true]) {
      events.length = 0;
      mixer.player.setAudioSamplingEnabled(enabled);
      assert.deepEqual(events, [`sample:1:${enabled}`, `sample:2:${enabled}`, 'graph invalidated', 'gain:1:1']);
    }
  } finally { mixer.dispose(); }
});

test('preparing a sampled source invalidates only the standby graph before restoring its silent gain', () => {
  const first = deck(1), second = deck(2), events = [];
  const gain = {
    set: (player, value) => events.push(`gain:${player.id}:${value}`),
    samplingChanged: (player) => events.push(`invalidate:${player?.id ?? 'all'}`), dispose() {},
  };
  const mixer = new CrossfadePlayer(first, second, gain);
  try {
    mixer.player.setAudioSamplingEnabled(true);
    events.length = 0;
    mixer.prepare('next', 'next');
    assert.deepEqual(events, ['gain:2:0', 'invalidate:2', 'gain:2:0']);
  } finally { mixer.dispose(); }
});
