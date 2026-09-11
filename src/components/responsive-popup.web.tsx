import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useWindowDimensions } from 'react-native';

import { SymbolView } from '@/components/app-symbol';
import { POPUP_CLOSE_SIZE, POPUP_DESKTOP_INSET, POPUP_MOBILE_INSET } from '@/components/popup-layout';
import type { ResponsivePopupProps } from '@/components/responsive-popup';
import { useAppSettings } from '@/providers/settings-provider';

const focusableSelector = 'button:not(:disabled), [role="button"][tabindex="0"], a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';
const popupStack: HTMLDivElement[] = [];

function synchronizePopupStack() {
  const top = popupStack.at(-1);
  for (const popup of popupStack) {
    const covered = popup !== top;
    if (covered && document.activeElement instanceof HTMLElement && popup.contains(document.activeElement)) document.activeElement.blur();
    popup.inert = covered;
    if (covered) popup.setAttribute('aria-hidden', 'true');
    else popup.removeAttribute('aria-hidden');
    popup.setAttribute('aria-modal', String(!covered));
  }
}

function scrollableAncestor(target: HTMLElement, panel: HTMLElement) {
  let current: HTMLElement | null = target;
  while (current && current !== panel) {
    if (/(auto|scroll)/.test(getComputedStyle(current).overflowY) && current.scrollHeight > current.clientHeight + 1) return current;
    current = current.parentElement;
  }
  return null;
}

type SheetDrag = {
  x: number; y: number; lastY: number; lastAt: number;
  distance: number; velocity: number; dragging: boolean; blocked: boolean;
  scroller: HTMLElement | null;
};

/** A viewport overlay: anchored desktop popover and Android-like phone sheet. */
export default function ResponsivePopup({ children, onDismiss, label, anchor, width = 340, expanded }: ResponsivePopupProps) {
  const { colors, isDark, reduceMotion } = useAppSettings();
  const viewport = useWindowDimensions();
  const desktop = viewport.width >= 960;
  const contentInset = desktop ? POPUP_DESKTOP_INSET : POPUP_MOBILE_INSET;
  const panel = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  const closingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [panelHeight, setPanelHeight] = useState(340);
  const [closing, setClosing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [entered, setEntered] = useState(reduceMotion);

  useLayoutEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);

  const requestDismiss = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const finish = () => {
      if (document.activeElement instanceof HTMLElement && panel.current?.contains(document.activeElement)) document.activeElement.blur();
      dismiss.current();
    };
    if (reduceMotion) finish();
    else {
      setClosing(true);
      closeTimer.current = setTimeout(finish, desktop ? 150 : 220);
    }
  }, [desktop, reduceMotion]);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setPanelHeight(entry.borderBoxSize?.[0]?.blockSize || element.getBoundingClientRect().height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const previous = anchor?.trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    popupStack.push(element);
    // Move focus before covering the previous portal or before the navigation
    // stack's passive effects mark its source scene aria-hidden.
    element.focus({ preventScroll: true });
    synchronizePopupStack();
    const onKeyDown = (event: KeyboardEvent) => {
      // A song menu can sit above the phone's Player details sheet. Only the
      // uppermost portal owns keyboard dismissal and focus containment.
      if (popupStack.at(-1) !== element) return;
      if (closingRef.current) { event.preventDefault(); event.stopPropagation(); return; }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        requestDismiss();
      }
      if (event.key !== 'Tab' || !element) return;
      const items = Array.from(element.querySelectorAll<HTMLElement>(focusableSelector)).filter((item) => item.getClientRects().length > 0);
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) {
        event.preventDefault();
        element.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (document.activeElement instanceof HTMLElement && element.contains(document.activeElement)) document.activeElement.blur();
      const index = popupStack.indexOf(element);
      if (index !== -1) popupStack.splice(index, 1);
      synchronizePopupStack();
      requestAnimationFrame(() => {
        const activePopup = popupStack.at(-1);
        if (previous?.isConnected && !previous.closest('[aria-hidden="true"], [inert]') && (!activePopup || activePopup.contains(previous))) previous.focus({ preventScroll: true });
      });
    };
  }, [anchor, requestDismiss]);

  useEffect(() => {
    const element = panel.current;
    if (desktop || !element) return;
    let gesture: SheetDrag | null = null;
    let suppressClickUntil = 0;
    const start = (x: number, y: number, target: EventTarget | null) => {
      if (popupStack.at(-1) !== element || closingRef.current || !(target instanceof Element)) return;
      let node: Element | null = target;
      while (node && !(node instanceof HTMLElement)) node = node.parentElement;
      if (!node || node.closest('input, textarea, select, [contenteditable="true"], [role="slider"], [data-no-sheet-drag]')) return;
      gesture = { x, y, lastY: y, lastAt: Date.now(), distance: 0, velocity: 0, dragging: false, blocked: false, scroller: scrollableAncestor(node, element) };
    };
    const move = (x: number, y: number, event: Event) => {
      if (!gesture || gesture.blocked) return;
      const deltaX = x - gesture.x;
      const deltaY = y - gesture.y;
      if (!gesture.dragging) {
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 8) return;
        // Scrolling and sideways gestures keep ownership for their whole touch.
        if (deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY) || (gesture.scroller?.scrollTop || 0) > 0) {
          gesture.blocked = true;
          return;
        }
        gesture.dragging = true;
        setEntered(true);
        setDragging(true);
        suppressClickUntil = Date.now() + 500;
      }
      if (event.cancelable) event.preventDefault();
      const now = Date.now();
      gesture.velocity = (y - gesture.lastY) / Math.max(16, now - gesture.lastAt);
      gesture.lastY = y;
      gesture.lastAt = now;
      gesture.distance = Math.max(0, deltaY);
      setDragOffset(gesture.distance);
    };
    const end = (cancelled = false) => {
      if (!gesture) return;
      const finished = gesture;
      gesture = null;
      if (!finished.dragging) return;
      suppressClickUntil = Date.now() + 500;
      setDragging(false);
      const velocity = Date.now() - finished.lastAt < 100 ? finished.velocity : 0;
      const threshold = Math.max(80, Math.min(150, element.getBoundingClientRect().height * 0.24));
      if (!cancelled && (finished.distance > threshold || (finished.distance > 32 && velocity > 0.65))) requestDismiss();
      else setDragOffset(0);
    };
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      start(touch.clientX, touch.clientY, event.target);
    };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) { end(true); return; }
      const touch = event.touches[0];
      move(touch.clientX, touch.clientY, event);
    };
    const touchEnd = () => end();
    const touchCancel = () => end(true);
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && event.button === 0) start(event.clientX, event.clientY, event.target);
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      move(event.clientX, event.clientY, event);
      if (gesture?.dragging) element.setPointerCapture?.(event.pointerId);
    };
    const pointerUp = (event: PointerEvent) => { if (event.pointerType !== 'touch') end(); };
    const pointerCancel = (event: PointerEvent) => { if (event.pointerType !== 'touch') end(true); };
    const click = (event: MouseEvent) => {
      if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    element.addEventListener('touchstart', touchStart, { passive: true });
    element.addEventListener('touchmove', touchMove, { passive: false });
    element.addEventListener('touchend', touchEnd);
    element.addEventListener('touchcancel', touchCancel);
    element.addEventListener('pointerdown', pointerDown);
    element.addEventListener('pointermove', pointerMove);
    element.addEventListener('pointerup', pointerUp);
    element.addEventListener('pointercancel', pointerCancel);
    element.addEventListener('click', click, true);
    return () => {
      element.removeEventListener('touchstart', touchStart);
      element.removeEventListener('touchmove', touchMove);
      element.removeEventListener('touchend', touchEnd);
      element.removeEventListener('touchcancel', touchCancel);
      element.removeEventListener('pointerdown', pointerDown);
      element.removeEventListener('pointermove', pointerMove);
      element.removeEventListener('pointerup', pointerUp);
      element.removeEventListener('pointercancel', pointerCancel);
      element.removeEventListener('click', click, true);
    };
  }, [desktop, requestDismiss]);

  const actualWidth = Math.min(width, viewport.width - 32);
  const left = anchor ? Math.max(16, Math.min(anchor.right - actualWidth, viewport.width - actualWidth - 16)) : (viewport.width - actualWidth) / 2;
  const roomBelow = anchor ? Math.max(80, viewport.height - anchor.bottom - 22) : viewport.height - 48;
  const roomAbove = anchor ? Math.max(80, anchor.top - 22) : viewport.height - 48;
  const above = Boolean(anchor && roomBelow < panelHeight && roomAbove > roomBelow);
  const placement: CSSProperties = anchor
    ? above ? { bottom: Math.max(16, viewport.height - anchor.top + 6), maxHeight: roomAbove } : { top: Math.max(16, anchor.bottom + 6), maxHeight: roomBelow }
    : { top: Math.max(24, (viewport.height - panelHeight) / 2), maxHeight: viewport.height - 48 };
  const originX = anchor ? Math.max(12, Math.min(actualWidth - 12, (anchor.left + anchor.right) / 2 - left)) : actualWidth / 2;
  const originGap = anchor ? (anchor.bottom - anchor.top) / 2 + 6 : 0;
  const panelAnimation = desktop ? above ? 'crimson-menu-above-in' : 'crimson-menu-below-in' : 'crimson-sheet-in';
  const panelStyle: CSSProperties = {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    color: colors.text,
    background: colors.elevated,
    border: `1px solid ${colors.border}`,
    boxShadow: isDark ? '0 24px 90px rgba(0,0,0,0.55)' : '0 24px 90px rgba(20,10,35,0.22)',
    outline: 'none',
    overflow: 'hidden',
    pointerEvents: closing ? 'none' : 'auto',
    transformOrigin: desktop ? `${originX}px ${above ? `calc(100% + ${originGap}px)` : `${-originGap}px`}` : 'center bottom',
    animation: reduceMotion || entered || closing || dragging || dragOffset > 0 ? 'none' : `${panelAnimation} ${desktop ? 220 : 280}ms cubic-bezier(.2,.9,.25,1) backwards`,
    transform: closing ? desktop ? `translateY(${above ? 5 : -5}px) scale(.94)` : `translateY(${viewport.height}px)` : `translateY(${desktop ? 0 : dragOffset}px)`,
    opacity: closing && desktop ? 0 : 1,
    transition: reduceMotion || dragging ? 'none' : `transform ${closing ? desktop ? 150 : 220 : 260}ms cubic-bezier(.2,.9,.25,1), opacity 150ms ease`,
    ...(desktop
      ? { ...placement, left, width: actualWidth, borderRadius: 15, ...(expanded ? { height: Math.min(560, viewport.height - 80) } : {}) }
      : { left: 0, right: 0, bottom: 0, maxHeight: 'min(88dvh, 780px)', borderRadius: '28px 28px 0 0', paddingBottom: 'env(safe-area-inset-bottom, 0px)', ...(expanded ? { height: '78dvh' } : {}) }),
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="crimson-popup"
      onPointerDown={(event) => { if (event.target === event.currentTarget) requestDismiss(); }}
      onKeyDown={(event) => event.stopPropagation()}
      style={{ '--crimson-accent': colors.accent, position: 'fixed', inset: 0, zIndex: 1000, background: desktop ? 'rgba(5,3,10,0.2)' : `rgba(5,3,10,${0.46 * Math.max(0.12, 1 - dragOffset / Math.max(1, panelHeight))})`, opacity: closing ? 0 : 1, transition: reduceMotion || dragging ? 'none' : 'opacity 180ms ease, background 260ms ease', animation: reduceMotion ? undefined : 'crimson-popup-in 140ms ease-out' } as CSSProperties}>
      <style>{`
        @keyframes crimson-popup-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes crimson-menu-below-in { from { opacity: 0; transform: translateY(-6px) scale(.86); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes crimson-menu-above-in { from { opacity: 0; transform: translateY(6px) scale(.86); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes crimson-sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} style={panelStyle} onAnimationEnd={(event) => { if (event.target === event.currentTarget) setEntered(true); }}>
        {!desktop ? <div data-popup-drag-handle style={{ position: 'absolute', top: 0, left: 'calc(50% - 32px)', width: 64, height: contentInset, touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab', zIndex: 2 }}>
          <div aria-hidden style={{ width: 38, height: 4, margin: '7px auto 0', borderRadius: 9, background: colors.mutedText, opacity: 0.45 }} />
        </div> : null}
        <button type="button" aria-label="Close menu" data-no-sheet-drag onClick={requestDismiss} style={{ position: 'absolute', right: contentInset, top: contentInset, width: POPUP_CLOSE_SIZE, height: POPUP_CLOSE_SIZE, borderRadius: 30, background: colors.controlSurface, border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 2 }}>
          <SymbolView name="xmark" size={16} tintColor={colors.secondaryText} />
        </button>
        <div data-popup-content style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: expanded ? '1 1 auto' : '0 1 auto', overflow: 'hidden', overscrollBehavior: 'contain' }}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
