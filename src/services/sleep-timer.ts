export const sleepTimerMinutes = [5, 15, 30, 45, 60, 90] as const;
export type SleepTimerMinutes = typeof sleepTimerMinutes[number];
export type SleepTimerSnapshot = {
  mode: 'off' | 'duration' | 'end-of-track';
  id: number;
  deadlineAt: number | null;
  endIdentity: string | null;
  endTitle: string | null;
  durationMinutes: SleepTimerMinutes | null;
};

export const inactiveSleepTimer: SleepTimerSnapshot = Object.freeze({
  mode: 'off', id: 0, deadlineAt: null, endIdentity: null,
  endTitle: null, durationMinutes: null,
});

type TimerOptions = {
  now?: () => number;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  cancelSchedule?: (handle: unknown) => void;
  onExpire: (expired: SleepTimerSnapshot) => void;
};

/** Wall-clock timer; native enforcement must also arm deadlineAt for background playback. */
export class SleepTimerController {
  private state: SleepTimerSnapshot = inactiveSleepTimer;
  private generation = 0;
  private handle: unknown;
  private disposed = false;
  private readonly now: () => number;
  private readonly schedule: NonNullable<TimerOptions['schedule']>;
  private readonly cancelSchedule: NonNullable<TimerOptions['cancelSchedule']>;
  private readonly onExpire: TimerOptions['onExpire'];
  private listeners = new Set<() => void>();

  constructor(options: TimerOptions) {
    this.now = options.now ?? Date.now;
    this.schedule = options.schedule ?? ((callback, delay) => setTimeout(callback, delay));
    this.cancelSchedule = options.cancelSchedule ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.onExpire = options.onExpire;
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  startMinutes(minutes: SleepTimerMinutes): SleepTimerSnapshot {
    if (!sleepTimerMinutes.includes(minutes)) throw new Error('Choose a sleep timer from 5 to 90 minutes.');
    this.assertActive();
    this.clearScheduled();
    this.publish({ ...inactiveSleepTimer, mode: 'duration', id: ++this.generation,
      deadlineAt: this.now() + minutes * 60_000, durationMinutes: minutes });
    this.scheduleTick();
    return this.state;
  }

  startEndOfTrack(endIdentity: string, endTitle?: string): SleepTimerSnapshot {
    if (!endIdentity) throw new Error('Play a song before setting an end-of-song timer.');
    this.assertActive();
    this.clearScheduled();
    this.publish({ ...inactiveSleepTimer, mode: 'end-of-track', id: ++this.generation, endIdentity, endTitle: endTitle || null });
    return this.state;
  }

  cancel(): void {
    this.clearScheduled();
    if (this.state.mode !== 'off') this.publish(inactiveSleepTimer);
  }

  /** Reconcile on foreground/status updates, including time while JS was suspended. */
  check(): boolean {
    if (this.state.mode !== 'duration' || this.state.deadlineAt === null) return false;
    return this.now() >= this.state.deadlineAt ? this.expire(this.state.id) : false;
  }

  /** Native expiry events carry the armed generation; late events cannot stop a replacement timer. */
  expire(id: number): boolean {
    if (this.state.mode === 'off' || this.state.id !== id) return false;
    const expired = this.state;
    this.cancel();
    this.onExpire(expired);
    return true;
  }

  /** Return true so playback consumes the finish without repeat, autoplay or queue advance. */
  onTrackEnded(identity: string): boolean {
    return this.inhibitsNextTrack(identity) ? this.expire(this.state.id) : false;
  }

  /** Timed mode survives skips; the song-specific option is canceled when its activation changes. */
  onTrackChanged(identity: string | null): boolean {
    if (this.state.mode !== 'end-of-track' || this.state.endIdentity === identity) return false;
    this.cancel();
    return true;
  }

  inhibitsNextTrack(identity: string): boolean {
    return this.state.mode === 'end-of-track' && this.state.endIdentity === identity;
  }

  dispose(): void {
    this.cancel();
    this.disposed = true;
    this.listeners.clear();
  }

  private assertActive() { if (this.disposed) throw new Error('This sleep timer is no longer active.'); }
  private publish(state: SleepTimerSnapshot) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  private clearScheduled() {
    if (this.handle !== undefined) this.cancelSchedule(this.handle);
    this.handle = undefined;
  }
  private scheduleTick() {
    if (this.state.mode !== 'duration' || this.state.deadlineAt === null) return;
    const id = this.state.id;
    this.handle = this.schedule(() => {
      // Cancelled native/JS jobs may already be queued when a new timer starts.
      if (this.state.id !== id || this.state.mode !== 'duration') return;
      this.handle = undefined;
      if (!this.check()) this.scheduleTick();
    }, Math.max(1, this.state.deadlineAt - this.now()));
  }
}

export function sleepTimerStatus(timer: SleepTimerSnapshot, now = Date.now()): string {
  if (timer.mode === 'off') return 'Off';
  if (timer.mode === 'end-of-track') return 'End of current song';
  const seconds = Math.max(0, Math.ceil(((timer.deadlineAt ?? now) - now) / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} remaining`;
}
