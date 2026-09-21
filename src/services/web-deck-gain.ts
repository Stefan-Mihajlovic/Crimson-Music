import type { AudioPlayer } from 'expo-audio';
import type { DeckGainControl } from '@/services/crossfade-player';
import { normalizeEqualizer, EQUALIZER_FREQUENCIES, EQUALIZER_FILTER_TYPES, DEFAULT_EQUALIZER, type EqualizerSettings } from './equalizer';
import { equalizerPreampDb, equalizerSafePreampDb, EQUALIZER_Q, EQUALIZER_RAMP_SECONDS } from './equalizer-dsp';

/** Audited against Expo Audio 57.0.5; its TS-private fields remain JS properties. */
export const WEB_DECK_GAIN_EXPO_VERSION = '57.0.5';
type ExpoWebDeck = { media: HTMLAudioElement; sourceNode: MediaElementAudioSourceNode | null; analyser: AnalyserNode | null };
type Route = { media: HTMLAudioElement; source: MediaElementAudioSourceNode; output: AudioNode; gain: GainNode; sleepGain: GainNode; preamp: GainNode; filters: BiquadFilterNode[]; context: AudioContext; connected: boolean; limiter: AudioWorkletNode | null; limiterPending: boolean; limiterFailed: boolean };
const equalizerSettings = new WeakMap<AudioPlayer, EqualizerSettings>();
const sleepDeadlines = new WeakMap<AudioPlayer, number>();
const owners = new WeakMap<AudioPlayer, WebDeckGainControl>();
const limiterModules = new WeakMap<AudioContext, Promise<boolean>>();

function loadLimiter(context: AudioContext): Promise<boolean> {
  let pending = limiterModules.get(context);
  if (pending) return pending;
  if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined') return Promise.resolve(false);
  // Expo inlines its deployment prefix, including websites hosted in a subpath.
  const prefix = (process.env.EXPO_BASE_URL || '').replace(/^\/+|\/+$/g, '');
  const url = `${prefix ? `/${prefix}` : ''}/audio/crimson-peak-limiter-v1.js`;
  pending = new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => resolve(false), 10_000);
    try {
      void context.audioWorklet.addModule(url).then(() => { clearTimeout(timeout); resolve(true); }, () => { clearTimeout(timeout); resolve(false); });
    } catch { clearTimeout(timeout); resolve(false); }
  });
  limiterModules.set(context, pending);
  return pending;
}

function preampLevel(settings: EqualizerSettings, route: Pick<Route, 'limiter' | 'context'>) {
  return settings.enabled ? 10 ** ((route.limiter ? equalizerPreampDb(settings.bands) : equalizerSafePreampDb(settings.bands, route.context.sampleRate)) / 20) : 1;
}

/** Audio-thread deadline continues while a background tab throttles JavaScript. */
export function configureWebSleepTimer(players: readonly AudioPlayer[], deadlineAt: number): boolean {
  const deadline = Number.isFinite(deadlineAt) ? Math.max(0, deadlineAt) : 0;
  let supported = players.length > 0;
  for (const player of new Set(players)) {
    sleepDeadlines.set(player, deadline);
    const owner = owners.get(player);
    if (owner) supported = owner.updateSleepTimer(player) && supported;
    else if (!(player as unknown as Partial<ExpoWebDeck>).media) supported = false;
  }
  return supported;
}

/** Save settings before a graph exists, then update both live decks without reconnecting. */
export function configureWebEqualizer(players: readonly AudioPlayer[], settings: EqualizerSettings): boolean {
  const normalized = normalizeEqualizer(settings);
  let supported = players.length > 0;
  for (const player of new Set(players)) {
    equalizerSettings.set(player, normalized);
    const owner = owners.get(player);
    if (owner) supported = owner.updateEqualizer(player) && supported;
    else if (!(player as unknown as Partial<ExpoWebDeck>).media) supported = false;
  }
  return supported;
}

/** iOS browsers ignore HTMLMediaElement.volume. A Web Audio gain is required. */
export class WebDeckGainControl implements DeckGainControl {
  private routes = new Map<AudioPlayer, Route>();
  private contextFactory: () => AudioContext;
  constructor(contextFactory: () => AudioContext) { this.contextFactory = contextFactory; }

  samplingChanged = (deck?: AudioPlayer) => {
    // Expo reconnects source→destination on every disable call, including when
    // its analyser was already null. Node identity alone cannot detect this.
    if (deck) {
      const route = this.routes.get(deck);
      if (route) route.connected = false;
    } else this.routes.forEach((route) => { route.connected = false; });
  };

  updateSleepTimer = (deck: AudioPlayer): boolean => {
    const route = this.routes.get(deck);
    if (!route) return false;
    try {
      const now = route.context.currentTime;
      const deadline = sleepDeadlines.get(deck) || 0;
      const remaining = (deadline - Date.now()) / 1000;
      route.sleepGain.gain.cancelScheduledValues(now);
      route.sleepGain.gain.setValueAtTime(deadline > 0 && remaining <= 0 ? 0 : 1, now);
      if (deadline > 0 && remaining > 0) route.sleepGain.gain.setValueAtTime(0, now + remaining);
      return true;
    } catch { return false; }
  };

  updateEqualizer = (deck: AudioPlayer): boolean => {
    const route = this.routes.get(deck);
    if (!route) return false;
    try {
      const settings = equalizerSettings.get(deck) || DEFAULT_EQUALIZER;
      const now = route.context.currentTime;
      const ramp = (parameter: AudioParam, value: number) => {
        parameter.cancelScheduledValues(now);
        parameter.setValueAtTime(parameter.value, now);
        parameter.linearRampToValueAtTime(value, now + EQUALIZER_RAMP_SECONDS);
      };
      const enabled = route.limiter?.parameters.get('enabled');
      if (enabled) {
        enabled.cancelScheduledValues(now);
        // The processor protects the 25ms filter transition before exact bypass.
        enabled.setValueAtTime(settings.enabled && settings.bands.some((gain) => gain !== 0) ? 1 : 0, now);
      }
      ramp(route.preamp.gain, preampLevel(settings, route));
      route.filters.forEach((filter, index) => ramp(filter.gain, settings.enabled ? settings.bands[index] : 0));
      return true;
    } catch { return false; }
  };

  private disconnectRoute(route: Route) {
    for (const node of [route.preamp, ...route.filters, route.limiter, route.gain, route.sleepGain]) {
      if (!node) continue;
      try { node.disconnect(); } catch { /* Already detached. */ }
    }
  }

  private disposeLimiter(route: Route) {
    if (!route.limiter) return;
    route.limiter.onprocessorerror = null;
    try { route.limiter.port.postMessage({ type: 'dispose' }); route.limiter.port.close(); } catch { /* Already released. */ }
    try { route.limiter.disconnect(); } catch { /* Already detached. */ }
    route.limiter = null;
  }

  private limiterFailed(deck: AudioPlayer, route: Route) {
    this.disposeLimiter(route);
    route.limiterFailed = true;
    const now = route.context.currentTime;
    // Restore headroom before bypassing a failed processor, without touching
    // the listener's crossfade volume or the scheduled sleep deadline.
    route.preamp.gain.cancelScheduledValues(now);
    route.preamp.gain.setValueAtTime(preampLevel(equalizerSettings.get(deck) || DEFAULT_EQUALIZER, route), now);
    route.filters.at(-1)!.disconnect();
    route.filters.at(-1)!.connect(route.gain);
  }

  private initializeLimiter(deck: AudioPlayer, route: Route) {
    if (route.limiter || route.limiterFailed || route.limiterPending || !route.connected) return;
    route.limiterPending = true;
    void loadLimiter(route.context).then((loaded) => {
      route.limiterPending = false;
      const internal = deck as unknown as Partial<ExpoWebDeck>;
      if (this.routes.get(deck) !== route || internal.media !== route.media || internal.sourceNode !== route.source) return;
      if (!loaded) { route.limiterFailed = true; return; }
      if (!route.connected) return; // A later set() reconnects and retries from the cached module.
      try {
        const settings = equalizerSettings.get(deck) || DEFAULT_EQUALIZER;
        const limiter = new AudioWorkletNode(route.context, 'crimson-peak-limiter-v1', {
          numberOfInputs: 1, numberOfOutputs: 1, channelCountMode: 'max',
          parameterData: { enabled: settings.enabled && settings.bands.some((gain) => gain !== 0) ? 1 : 0 },
        });
        route.limiter = limiter;
        limiter.onprocessorerror = () => {
          if (this.routes.get(deck) !== route || route.limiter !== limiter) return;
          try { this.limiterFailed(deck, route); } catch { route.connected = false; }
        };
        route.filters.at(-1)!.disconnect();
        route.filters.at(-1)!.connect(limiter);
        limiter.connect(route.gain);
        this.updateEqualizer(deck);
      } catch {
        try { this.limiterFailed(deck, route); } catch { route.connected = false; }
      }
    });
  }

  unlock = () => {
    // Called synchronously from play/seek gestures, before resolving a stream URL.
    try {
      const contexts = new Set([this.contextFactory(), ...[...this.routes.values()].map((route) => route.context)]);
      contexts.forEach((context) => { if (context.state === 'suspended') void context.resume().catch(() => undefined); });
    } catch { /* This browser cannot create a graph. ready() prevents overlap. */ }
  };

  set = (deck: AudioPlayer, value: number) => {
    const internal = deck as unknown as Partial<ExpoWebDeck>;
    const media = internal.media;
    if (!media) return;
    const level = Math.max(0, Math.min(1, value));
    let route = this.routes.get(deck);
    try {
      if (route && (route.media !== media || route.source !== internal.sourceNode)) {
        this.disconnectRoute(route); this.disposeLimiter(route); this.routes.delete(deck); route = undefined;
      }
      const context = (internal.sourceNode?.context as AudioContext | undefined) || this.contextFactory();
      if (!internal.sourceNode) internal.sourceNode = context.createMediaElementSource(media);
      const source = internal.sourceNode;
      const output = internal.analyser || source;
      if (!route) {
        const gain = context.createGain();
        const sleepGain = context.createGain();
        const preamp = context.createGain();
        const settings = equalizerSettings.get(deck) || DEFAULT_EQUALIZER;
        preamp.gain.value = preampLevel(settings, { limiter: null, context });
        const filters = EQUALIZER_FREQUENCIES.map((frequency, index) => {
          const filter = context.createBiquadFilter();
          filter.type = EQUALIZER_FILTER_TYPES[index];
          filter.frequency.value = Math.min(frequency, context.sampleRate * 0.45);
          filter.Q.value = EQUALIZER_Q;
          filter.gain.value = settings.enabled ? settings.bands[index] : 0;
          return filter;
        });
        gain.gain.value = level;
        route = { media, source, output, gain, sleepGain, preamp, filters, context, connected: false, limiter: null, limiterPending: false, limiterFailed: false };
        this.routes.set(deck, route);
        owners.set(deck, this);
        this.updateSleepTimer(deck);
      }
      if (!route.connected || route.output !== output) {
        // Spectrum toggles reconnect Expo's source/analyser to the destination.
        // Keep that analyser, replacing only its final output with our gain.
        source.disconnect();
        if (internal.analyser) {
          source.connect(internal.analyser);
          internal.analyser.disconnect();
        }
        output.connect(route.preamp);
        route.preamp.connect(route.filters[0]);
        route.filters.forEach((filter, index) => filter.connect(route!.filters[index + 1] || route!.limiter || route!.gain));
        route.limiter?.connect(route.gain);
        route.gain.connect(route.sleepGain);
        route.sleepGain.connect(context.destination);
        route.output = output;
        route.connected = true;
      }
      media.volume = 1;
      media.muted = false;
      route.gain.gain.value = level;
      this.initializeLimiter(deck, route);
    } catch {
      if (route) {
        route.connected = false;
        this.disconnectRoute(route);
      }
      // Restore single-deck audio if graph creation fails after attachment.
      // Muting a standby element is supported even where element volume is not.
      try {
        const source = internal.sourceNode;
        source?.disconnect(); source?.connect(source.context.destination);
        media.muted = level === 0;
        media.volume = 1;
      } catch { media.muted = level === 0; }
    }
  };

  ready = (deck: AudioPlayer) => {
    const route = this.routes.get(deck);
    return Boolean(route?.connected && route.context.state === 'running');
  };

  dispose = () => {
    this.routes.forEach((route, deck) => { this.disconnectRoute(route); this.disposeLimiter(route); owners.delete(deck); });
    this.routes.clear();
  };
}
