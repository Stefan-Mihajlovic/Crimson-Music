import React from 'react';
import { act, create } from 'react-test-renderer';
import { useSettledLayoutWidth } from '../src/hooks/use-settled-layout-width';

let root;
let layout;
const renders = [];
function Probe() {
  const [width, onLayout] = useSettledLayoutWidth();
  layout = onLayout;
  renders.push(width);
  return null;
}
const measure = (width) => layout({ nativeEvent: { layout: { width } } });
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
  renders.length = 0;
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
  jest.useRealTimers();
});

test('a resize burst only updates artwork after settling, using the last measurement', async () => {
  await act(async () => { root = create(<Probe />); });
  await act(async () => measure(1100));
  expect(renders).toEqual([0, 1100]);
  for (const width of [1090, 1060, 950, 880, 1000, 1099.75]) {
    await act(async () => { measure(width); jest.advanceTimersByTime(16); });
  }
  expect(renders).toEqual([0, 1100]);
  await act(async () => jest.advanceTimersByTime(120));
  expect(renders).toEqual([0, 1100, 1099]);
  // A zero-size observation from a hidden route cannot replace the final size.
  await act(async () => { measure(0); jest.advanceTimersByTime(150); });
  expect(renders).toEqual([0, 1100, 1099]);
});

test('unmount cancels the pending measurement', async () => {
  await act(async () => { root = create(<Probe />); });
  await act(async () => { measure(1100); measure(900); });
  expect(jest.getTimerCount()).toBe(1);
  await act(async () => root.unmount());
  root = undefined;
  expect(jest.getTimerCount()).toBe(0);
});
