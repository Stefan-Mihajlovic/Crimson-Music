type PlayerMotion = { position: number; collapsedTop: number; phase: 'rest' | 'dragging' | 'settling' };
export type WebPlayerMotionSession = symbol;
const initial: PlayerMotion = { position: 0, collapsedTop: 1, phase: 'rest' };
let state = initial;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let frame: number | undefined;
let currentSession: WebPlayerMotionSession | undefined;

function clearScheduledMotion() {
  clearTimeout(timer);
  timer = undefined;
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = undefined;
}

function ownsMotion(session: WebPlayerMotionSession | undefined) {
  return session !== undefined && session === currentSession;
}

function publish(next: PlayerMotion) {
  state = next;
  listeners.forEach((listener) => listener());
}
export const getWebPlayerMotion = () => state;
export const getServerWebPlayerMotion = () => initial;
export const getWebPlayerMotionSession = () => currentSession;
export function subscribeWebPlayerMotion(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function beginWebPlayerMotion(position: number, collapsedTop: number) {
  clearScheduledMotion();
  const session = Symbol('player-motion');
  currentSession = session;
  publish({ position, collapsedTop: Math.max(1, collapsedTop), phase: 'dragging' });
  return session;
}
export function cancelWebPlayerMotion(session: WebPlayerMotionSession | undefined) {
  if (!ownsMotion(session)) return;
  clearScheduledMotion();
  currentSession = undefined;
  publish(initial);
}
export function moveWebPlayerMotion(session: WebPlayerMotionSession | undefined, position: number) {
  if (!ownsMotion(session)) return;
  publish({ ...state, position: Math.max(0, Math.min(state.collapsedTop, position)), phase: 'dragging' });
}
export function settleWebPlayerMotion(session: WebPlayerMotionSession | undefined, open: boolean, reduceMotion: boolean, onFinished?: () => void, afterPaint = false) {
  if (!ownsMotion(session)) return;
  clearScheduledMotion();
  const settle = () => {
    frame = undefined;
    if (!ownsMotion(session)) return;
    publish({ ...state, position: open ? 0 : state.collapsedTop, phase: 'settling' });
    const finish = () => {
      if (!ownsMotion(session)) return;
      cancelWebPlayerMotion(session);
      onFinished?.();
    };
    if (reduceMotion) finish();
    else timer = setTimeout(finish, 280);
  };
  // Keep the initial geometry painted before animating, with frames owned by
  // the same session as the completion callback so route teardown cancels both.
  if (afterPaint && !reduceMotion) frame = requestAnimationFrame(() => { frame = requestAnimationFrame(settle); });
  else settle();
}
