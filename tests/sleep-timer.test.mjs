import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SleepTimerController, inactiveSleepTimer, sleepTimerMinutes, sleepTimerStatus } from '../src/services/sleep-timer.ts';

function fixture() {
  let now = 1_000_000, sequence = 0;
  const scheduled = new Map(), expired = [];
  const timer = new SleepTimerController({ now: () => now, onExpire: (value) => expired.push(value),
    schedule: (callback, delay) => { const id = ++sequence; scheduled.set(id, { callback, at: now + delay }); return id; },
    cancelSchedule: (id) => scheduled.delete(id) });
  return { timer, scheduled, expired, now: () => now,
    advance: (ms) => { now += ms; },
    fire: () => { for (const [id, job] of scheduled) if (job.at <= now) { scheduled.delete(id); job.callback(); } } };
}

test('all offered durations arm an absolute deadline with a stable external-store snapshot', () => {
  const f = fixture();
  let notifications = 0;
  f.timer.subscribe(() => notifications++);
  for (const minutes of sleepTimerMinutes) {
    const state = f.timer.startMinutes(minutes);
    assert.equal(state.deadlineAt, f.now() + minutes * 60_000);
    assert.equal(sleepTimerStatus(state, f.now()), `${minutes}:00 remaining`);
    f.advance(1_000);
    assert.equal(f.timer.check(), false);
    assert.equal(f.timer.getSnapshot(), state, 'countdown does not publish player-context updates');
    assert.equal(f.scheduled.size, 1);
  }
  assert.equal(notifications, 6);
  assert.throws(() => f.timer.startMinutes(0));
  f.timer.dispose();
});

test('wall-clock expiry pauses once even when JS wakes long after the deadline', () => {
  const f = fixture();
  const armed = f.timer.startMinutes(5);
  f.advance(9 * 60_000);
  assert.equal(f.timer.check(), true);
  assert.equal(f.timer.getSnapshot(), inactiveSleepTimer);
  assert.deepEqual(f.expired, [armed]);
  f.fire();
  assert.equal(f.timer.check(), false);
  assert.equal(f.expired.length, 1);
});

test('duration survives track changes and paused time, then its scheduled deadline expires', () => {
  const f = fixture();
  f.timer.startMinutes(15);
  assert.equal(f.timer.onTrackChanged('song:next'), false);
  f.advance(15 * 60_000);
  f.fire();
  assert.equal(f.expired.length, 1);
  assert.equal(f.timer.getSnapshot().mode, 'off');
});

test('replacement and cancellation ignore an already queued old callback or native expiration', () => {
  const f = fixture();
  const old = f.timer.startMinutes(5);
  const staleCallback = [...f.scheduled.values()][0].callback;
  const replacement = f.timer.startMinutes(90);
  f.advance(5 * 60_000);
  staleCallback();
  assert.equal(f.timer.expire(old.id), false);
  assert.equal(f.timer.getSnapshot(), replacement);
  f.timer.cancel();
  f.advance(100 * 60_000); f.fire();
  assert.equal(f.expired.length, 0);
  assert.equal(f.scheduled.size, 0);
});

test('end-of-song consumes only its bound activation and inhibits crossfade, repeat and queue progression', () => {
  const f = fixture();
  const active = f.timer.startEndOfTrack('track:activation-1', 'Favorite song');
  assert.equal(active.endTitle, 'Favorite song');
  assert.equal(f.scheduled.size, 0);
  assert.equal(f.timer.inhibitsNextTrack('track:activation-1'), true);
  assert.equal(f.timer.onTrackEnded('track:old-activation'), false);
  assert.equal(f.timer.onTrackChanged('track:activation-1'), false);
  assert.equal(f.timer.onTrackEnded('track:activation-1'), true);
  assert.equal(f.timer.onTrackEnded('track:activation-1'), false);
  assert.deepEqual(f.expired, [active]);
});

test('manually changing a song cancels only the end-of-song timer, including replaying the same song', () => {
  const f = fixture();
  f.timer.startEndOfTrack('track:activation-1');
  assert.equal(f.timer.onTrackChanged('track:activation-2'), true);
  assert.equal(f.timer.getSnapshot().mode, 'off');
  assert.equal(f.timer.onTrackEnded('track:activation-1'), false);
  assert.equal(f.expired.length, 0);
  assert.throws(() => f.timer.startEndOfTrack(''));
});

test('countdown clamps to zero and disposing prevents later scheduled actions', () => {
  const f = fixture();
  const active = f.timer.startMinutes(5);
  assert.equal(sleepTimerStatus(active, active.deadlineAt - 61_000), '1:01 remaining');
  assert.equal(sleepTimerStatus(active, active.deadlineAt + 50_000), '0:00 remaining');
  f.timer.dispose();
  f.advance(10 * 60_000); f.fire();
  assert.equal(f.expired.length, 0);
  assert.throws(() => f.timer.startMinutes(5));
});
