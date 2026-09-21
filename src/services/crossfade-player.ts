import type { AudioPlayer, AudioSource } from 'expo-audio';

export const MAX_CROSSFADE_SECONDS = 12;

export function normalizeCrossfadeSeconds(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(MAX_CROSSFADE_SECONDS, Math.round(value)))
    : 0;
}

/** Never overlap more than half of either song, or crossfade repeat-one. */
export function crossfadeWindow(seconds: number, outgoingDuration: number, incomingDuration: number): number {
  if (!(outgoingDuration > 0) || !(incomingDuration > 0)) return 0;
  return Math.min(normalizeCrossfadeSeconds(seconds), outgoingDuration / 2, incomingDuration / 2);
}

type Transition = { outgoing: AudioPlayer; incoming: AudioPlayer; duration: number; startPosition: number; started: boolean; transportPaused: boolean };
export type DeckGainControl = { set: (deck: AudioPlayer, value: number) => void; ready?: (deck: AudioPlayer) => boolean; unlock?: () => void; samplingChanged?: (deck?: AudioPlayer) => void; dispose: () => void };

/**
 * Two persistent audio decks behind one stable player reference. Source changes
 * and account cleanup remain owned by PlayerProvider; a deck handoff must not
 * masquerade as a new provider/player lifetime.
 */
export class CrossfadePlayer {
  readonly player: AudioPlayer;
  private decks: [AudioPlayer, AudioPlayer];
  private index = 0;
  private gain = 1;
  private preparedKey: string | null = null;
  private transition: Transition | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  private sampling = false;
  private gainControl?: DeckGainControl;
  private transportSubscriptions: { remove: () => void }[] = [];

  constructor(first: AudioPlayer, second: AudioPlayer, gainControl?: DeckGainControl) {
    this.decks = [first, second];
    this.gainControl = gainControl;
    this.transportSubscriptions = [...new Set(this.decks)].map((deck) => deck.addListener('playbackStatusUpdate', () => {
      if (deck !== this.active || !this.transition) return;
      this.tick();
      if (this.transition && deck.playing && !deck.isBuffering) this.startTimer();
    }));
    const overrides: Record<string, unknown> = {
      pause: () => this.pause(),
      play: () => this.play(),
      replace: (source: AudioSource) => { this.cancel(); this.active.replace(source); this.setDeckVolume(this.active, this.gain); },
      seekTo: (...args: Parameters<AudioPlayer['seekTo']>) => { this.unlock(); this.finishTransition(); return this.active.seekTo(...args); },
      setAudioSamplingEnabled: (enabled: boolean) => {
        this.sampling = enabled;
        // Installing/removing iOS taps rebuilds AVPlayerItem.audioMix. Prepare
        // both decks while idle and keep their taps through a handoff; filter
        // sample events to the active deck instead of reconfiguring audible audio.
        for (const deck of new Set(this.decks)) {
          if (!enabled || deck.isAudioSamplingSupported) deck.setAudioSamplingEnabled(enabled);
        }
        this.gainControl?.samplingChanged?.();
        this.tick();
      },
      addListener: (event: string, listener: (...args: unknown[]) => void) => {
        // Sampling subscribers remain valid when a deck becomes active.
        const subscriptions = [...new Set(this.decks)].map((deck) => {
          const add = deck.addListener.bind(deck) as (event: string, listener: (...args: unknown[]) => void) => { remove: () => void };
          return add(event, (...args) => { if (deck === this.active) listener(...args); });
        });
        return { remove: () => subscriptions.forEach((subscription) => subscription.remove()) };
      },
    };
    this.player = new Proxy({} as AudioPlayer, {
      get: (_target, key) => {
        if (key === 'volume') return this.gain;
        if (typeof key === 'string' && key in overrides) return overrides[key];
        const value = Reflect.get(this.active, key, this.active);
        return typeof value === 'function' ? value.bind(this.active) : value;
      },
      set: (_target, key, value) => {
        if (key === 'volume') { this.gain = Math.max(0, Math.min(1, Number(value) || 0)); this.tick(); return true; }
        return Reflect.set(this.active, key, value, this.active);
      },
    });
  }

  private setDeckVolume(deck: AudioPlayer, value: number) {
    if (this.gainControl) this.gainControl.set(deck, value);
    else deck.volume = value;
  }

  get active() { return this.decks[this.index]; }
  get inactive() { return this.decks[1 - this.index]; }
  get isTransitioning() { return this.transition !== null; }
  getSnapshot = () => this.index;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  prepare(key: string, source: AudioSource): boolean {
    if (this.decks[0] === this.decks[1] || this.transition) return false;
    if (this.preparedKey === key) return true;
    this.clearPrepared();
    this.setDeckVolume(this.inactive, 0);
    this.inactive.loop = false;
    this.inactive.replace(source);
    if (this.sampling && this.inactive.isAudioSamplingSupported) {
      this.inactive.setAudioSamplingEnabled(true);
      this.gainControl?.samplingChanged?.(this.inactive);
    }
    this.setDeckVolume(this.inactive, 0);
    this.preparedKey = key;
    return true;
  }

  ready(key: string): boolean {
    return !this.transition && this.preparedKey === key && this.inactive.isLoaded
      && !this.inactive.isBuffering && this.inactive.duration > 0
      && (!this.gainControl?.ready || (this.gainControl.ready(this.active) && this.gainControl.ready(this.inactive)));
  }

  begin(key: string, seconds: number): boolean {
    if (!this.ready(key) || !(seconds > 0)) return false;
    const outgoing = this.active;
    const incoming = this.inactive;
    this.setDeckVolume(incoming, 0);
    try { incoming.play(); } catch { this.clearPrepared(); return false; }
    this.transition = { outgoing, incoming, duration: seconds, startPosition: incoming.currentTime || 0, started: incoming.playing, transportPaused: false };
    this.preparedKey = null;
    this.index = 1 - this.index;
    this.startTimer();
    this.listeners.forEach((listener) => listener());
    this.tick();
    return true;
  }

  /** Media time freezes during pauses/buffering, so the fade freezes too. */
  tick() {
    const fade = this.transition;
    if (!fade) { this.setDeckVolume(this.active, this.gain); return; }
    // System transport controls act on Expo's active deck directly, bypassing
    // the facade. Mirror pauses, interruptions and buffering to the old tail.
    if (fade.incoming.playing && !fade.incoming.isBuffering) {
      fade.started = true;
      if (fade.transportPaused && fade.outgoing.currentTime < fade.outgoing.duration) fade.outgoing.play();
      fade.transportPaused = false;
    } else if (fade.started && !fade.incoming.isBuffering) {
      fade.outgoing.pause();
      fade.transportPaused = true;
    }
    const progress = Math.max(0, Math.min(1, (fade.incoming.currentTime - fade.startPosition) / fade.duration));
    // Linear gains avoid boosting two highly correlated recordings above the
    // listener's selected level. The gain remains adjustable during a fade.
    this.setDeckVolume(fade.outgoing, this.gain * (1 - progress));
    this.setDeckVolume(fade.incoming, this.gain * progress);
    if (progress >= 1 || (this.gainControl?.ready && (!this.gainControl.ready(fade.outgoing) || !this.gainControl.ready(fade.incoming)))) this.finishTransition();
  }

  private startTimer() { if (!this.timer) this.timer = setInterval(() => this.tick(), 40); }

  clearPrepared(key?: string) {
    if (key && key !== this.preparedKey) return;
    if (!this.transition && this.preparedKey) {
      this.inactive.pause();
      this.setDeckVolume(this.inactive, 0);
      this.inactive.replace(null);
    }
    this.preparedKey = null;
  }

  finishTransition() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.transition) {
      this.transition.outgoing.pause();
      this.setDeckVolume(this.transition.outgoing, 0);
      this.transition = null;
    }
    this.setDeckVolume(this.active, this.gain);
  }

  unlock() { this.gainControl?.unlock?.(); }
  cancel() { this.unlock(); this.finishTransition(); this.clearPrepared(); }
  private pause() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.active.pause();
    this.transition?.outgoing.pause();
    if (this.transition) this.transition.transportPaused = true;
  }
  private play() {
    this.unlock();
    this.active.play();
    if (this.transition) {
      if (this.transition.outgoing.currentTime < this.transition.outgoing.duration) this.transition.outgoing.play();
      this.transition.transportPaused = false;
      this.startTimer();
    }
  }
  dispose() {
    try { this.cancel(); } catch { if (this.timer) clearInterval(this.timer); this.timer = null; this.transition = null; }
    [...new Set(this.decks)].forEach((deck) => { try { deck.pause(); } catch { /* Hook already released native player. */ } });
    this.transportSubscriptions.forEach((subscription) => subscription.remove());
    this.gainControl?.dispose();
    this.listeners.clear();
  }
}
