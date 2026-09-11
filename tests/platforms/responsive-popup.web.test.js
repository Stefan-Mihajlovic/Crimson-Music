import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ResponsivePopup from '../../src/components/responsive-popup';
import { SymbolView } from '../../src/components/app-symbol';

let mockReduceMotion = true;
jest.mock('../../src/providers/settings-provider', () => ({
  useAppSettings: () => ({ isDark: true, reduceMotion: mockReduceMotion, colors: { text: '#fff', secondaryText: '#aaa', mutedText: '#888', elevated: '#201a2a', controlSurface: '#30283a', border: '#44394e' } }),
}));

let root;
let container;
function resize(width) {
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
  window.dispatchEvent(new Event('resize'));
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  mockReduceMotion = true;
  resize(1280);
  container = document.createElement('div');
  container.style.transform = 'translateX(0)';
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  act(() => jest.runOnlyPendingTimers());
  container.remove();
  jest.useRealTimers();
});

test('desktop menu escapes transformed app scenes, bounds its width, and supports keyboard dismissal', () => {
  const onDismiss = jest.fn();
  act(() => root.render(<ResponsivePopup label="Song actions" onDismiss={onDismiss}><button>Play next</button><button>Add to queue</button></ResponsivePopup>));
  act(() => jest.runOnlyPendingTimers());
  const dialog = document.querySelector('[role="dialog"]');
  expect(container.contains(dialog)).toBe(false);
  expect(dialog.style.width).toBe('340px');
  expect(dialog.textContent).not.toContain('Song actions');
  expect(dialog.querySelector('[data-popup-drag-handle]')).toBeNull();
  expect([...dialog.children].filter((child) => child.style.position !== 'absolute')).toEqual([dialog.querySelector('[data-popup-content]')]);
  const close = dialog.querySelector('[aria-label="Close menu"]');
  expect(close.style.top).toBe('16px');
  expect(close.style.right).toBe('16px');
  expect(dialog.parentElement.style.position).toBe('fixed');
  expect(document.activeElement).toBe(dialog);
  const buttons = dialog.querySelectorAll('button');
  buttons.forEach((button) => { button.getClientRects = () => [{ width: 100, height: 32 }]; });
  buttons[buttons.length - 1].focus();
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(buttons[0]);
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test('phone menu is a bounded bottom sheet with an explicit close control', () => {
  resize(390);
  const onDismiss = jest.fn();
  act(() => root.render(<ResponsivePopup label="Song actions" onDismiss={onDismiss}><button>Play next</button></ResponsivePopup>));
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.style.bottom).toBe('0px');
  expect(dialog.style.left).toBe('0px');
  expect(dialog.style.right).toBe('0px');
  expect(dialog.style.maxHeight).toContain('88dvh');
  const handle = dialog.querySelector('[data-popup-drag-handle]');
  expect(handle.style.position).toBe('absolute');
  expect(handle.style.height).toBe('20px');
  const close = dialog.querySelector('[aria-label="Close menu"]');
  expect(close.style.top).toBe('20px');
  expect(close.style.right).toBe('20px');
  act(() => dialog.querySelector('[aria-label="Close menu"]').click());
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test('Escape closes only the top popup and restores its trigger without closing the full player', () => {
  const closeDetails = jest.fn();
  const closeSong = jest.fn();
  const closePlayer = jest.fn();
  const onPlayerKey = (event) => { if (event.key === 'Escape' && !event.defaultPrevented) closePlayer(); };
  window.addEventListener('keydown', onPlayerKey);
  let anchor;
  const render = (songMenu) => root.render(<>
    <ResponsivePopup label="Player details" onDismiss={closeDetails}><button data-song-trigger>Song options</button></ResponsivePopup>
    {songMenu ? <ResponsivePopup label="Song actions" anchor={anchor} onDismiss={() => { closeSong(); render(false); }}><button>Play next</button></ResponsivePopup> : null}
  </>);
  act(() => render(false));
  act(() => jest.runOnlyPendingTimers());
  const details = document.querySelector('[aria-label="Player details"]');
  const trigger = document.querySelector('[data-song-trigger]');
  trigger.focus();
  anchor = { left: 20, top: 40, right: 120, bottom: 72, trigger };
  const setAttribute = details.setAttribute.bind(details);
  let focusedWhenHidden = false;
  jest.spyOn(details, 'setAttribute').mockImplementation((name, value) => {
    if (name === 'aria-hidden' && value === 'true') focusedWhenHidden = details.contains(document.activeElement);
    setAttribute(name, value);
  });
  act(() => render(true));
  act(() => jest.runOnlyPendingTimers());
  expect(details.getAttribute('aria-hidden')).toBe('true');
  expect(details.inert).toBe(true);
  expect(focusedWhenHidden).toBe(false);
  const song = document.querySelector('[aria-label="Song actions"]');
  act(() => song.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  act(() => jest.runOnlyPendingTimers());
  expect(closeSong).toHaveBeenCalledTimes(1);
  expect(closeDetails).not.toHaveBeenCalled();
  expect(closePlayer).not.toHaveBeenCalled();
  expect(details.hasAttribute('aria-hidden')).toBe(false);
  expect(details.inert).toBe(false);
  expect(document.activeElement).toBe(trigger);
  window.removeEventListener('keydown', onPlayerKey);
});

test('desktop menu flips above a low trigger and animates from the three-dot position', () => {
  mockReduceMotion = false;
  const trigger = document.createElement('button');
  container.append(trigger);
  const anchor = { left: 1226, top: 728, right: 1258, bottom: 760, trigger };
  const onDismiss = jest.fn();
  act(() => root.render(<ResponsivePopup label="Song actions" anchor={anchor} onDismiss={onDismiss}><button>Play next</button></ResponsivePopup>));
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.style.bottom).toBe('78px');
  expect(dialog.style.top).toBe('');
  expect(dialog.style.left).toBe('918px');
  expect(dialog.style.transformOrigin).toBe('324px calc(100% + 22px)');
  expect(dialog.style.animation).toContain('crimson-menu-above-in');
  act(() => dialog.querySelector('[aria-label="Close menu"]').click());
  expect(onDismiss).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(150));
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

function touch(element, type, x, y) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const point = { identifier: 1, target: element, clientX: x, clientY: y, pageX: x, pageY: y, timestamp: Date.now() };
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' || type === 'touchcancel' ? [] : [point] },
    changedTouches: { value: [point] },
  });
  act(() => element.dispatchEvent(event));
  return event;
}

test('phone sheets follow downward drag, snap back on a short pull, and dismiss on a long pull', () => {
  resize(390);
  const onDismiss = jest.fn();
  act(() => root.render(<ResponsivePopup label="Song actions" onDismiss={onDismiss}><button>Play next</button></ResponsivePopup>));
  const dialog = document.querySelector('[role="dialog"]');
  const handle = dialog.querySelector('[data-popup-drag-handle]');
  touch(handle, 'touchstart', 190, 100);
  act(() => jest.advanceTimersByTime(500));
  expect(touch(handle, 'touchmove', 191, 140).defaultPrevented).toBe(true);
  expect(dialog.style.transform).toBe('translateY(40px)');
  touch(handle, 'touchend', 191, 140);
  expect(dialog.style.transform).toBe('translateY(0px)');
  expect(onDismiss).not.toHaveBeenCalled();
  touch(handle, 'touchstart', 190, 100);
  touch(handle, 'touchmove', 190, 290);
  touch(handle, 'touchend', 190, 290);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

test('scrolled content keeps its touch gesture; a new downward pull at the top drags the sheet without activating a row', () => {
  resize(390);
  const onDismiss = jest.fn();
  const rowAction = jest.fn();
  act(() => root.render(<ResponsivePopup label="Player details" expanded onDismiss={onDismiss}><div data-scroll style={{ overflowY: 'auto' }}><button onClick={rowAction}>A song</button></div></ResponsivePopup>));
  const dialog = document.querySelector('[role="dialog"]');
  const scroller = dialog.querySelector('[data-scroll]');
  const row = scroller.querySelector('button');
  Object.defineProperties(scroller, { scrollHeight: { value: 900 }, clientHeight: { value: 300 } });
  scroller.scrollTop = 120;
  touch(row, 'touchstart', 140, 220);
  expect(touch(row, 'touchmove', 140, 330).defaultPrevented).toBe(false);
  touch(row, 'touchend', 140, 330);
  expect(dialog.style.transform).toBe('translateY(0px)');
  expect(onDismiss).not.toHaveBeenCalled();
  scroller.scrollTop = 0;
  touch(row, 'touchstart', 140, 220);
  expect(touch(row, 'touchmove', 140, 350).defaultPrevented).toBe(true);
  expect(dialog.style.transform).toBe('translateY(130px)');
  touch(row, 'touchend', 140, 350);
  act(() => row.click());
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(rowAction).not.toHaveBeenCalled();
});

test('a slider and an upward content swipe do not start sheet dismissal', () => {
  resize(390);
  const onDismiss = jest.fn();
  act(() => root.render(<ResponsivePopup label="Player details" onDismiss={onDismiss}><input aria-label="Volume" type="range" /><div data-content>Queue</div></ResponsivePopup>));
  const dialog = document.querySelector('[role="dialog"]');
  const slider = dialog.querySelector('input');
  touch(slider, 'touchstart', 140, 220);
  expect(touch(slider, 'touchmove', 140, 390).defaultPrevented).toBe(false);
  touch(slider, 'touchend', 140, 390);
  const content = dialog.querySelector('[data-content]');
  touch(content, 'touchstart', 140, 300);
  expect(touch(content, 'touchmove', 140, 160).defaultPrevented).toBe(false);
  touch(content, 'touchend', 140, 160);
  expect(dialog.style.transform).toBe('translateY(0px)');
  expect(onDismiss).not.toHaveBeenCalled();
});

test('navigation and playback symbols render usable local SVG paths without icon-font text', () => {
  const names = ['house.fill', 'magnifyingglass', 'heart.fill', 'play.fill', 'pause.fill', 'speaker.wave.2.fill', 'arrow.up.left.and.arrow.down.right'];
  act(() => root.render(<>{names.map((name) => <SymbolView key={name} name={name} size={24} tintColor="#abcdef" />)}</>));
  expect(container.querySelectorAll('svg')).toHaveLength(names.length);
  expect([...container.querySelectorAll('path')].every((path) => path.getAttribute('d').length > 20)).toBe(true);
  expect(container.textContent).toBe('');
});
