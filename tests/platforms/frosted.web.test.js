import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import FrostedSurface from '../../src/components/frosted-surface';

let mockPerformance = false;
let mockDark = true;
jest.mock('../../src/providers/settings-provider', () => ({ useAppSettings: () => ({ performanceMode: mockPerformance, isDark: mockDark, colors: { elevated: mockDark ? '#201A2A' : '#F8F6FA', border: '#333', accent: '#95f' } }) }));
let root;
let container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockPerformance = false; mockDark = true;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const blurred = () => [...container.querySelectorAll('div')].filter((view) => view.style.backdropFilter?.includes('blur('));
test('web renders real CSS backdrop blur in both themes while controls stay clickable', () => {
  const onClick = jest.fn();
  const render = () => root.render(<FrostedSurface><button onClick={onClick}>Play</button></FrostedSurface>);
  act(render);
  expect(blurred()).toHaveLength(1);
  expect(blurred()[0].style.backdropFilter).not.toContain('saturate');
  expect([...container.querySelectorAll('div')].some((view) => view.style.backgroundColor === 'rgba(32, 26, 42, 0.8)')).toBe(true);
  act(() => container.querySelector('button').click());
  expect(onClick).toHaveBeenCalledTimes(1);
  mockDark = false; act(render);
  expect([...container.querySelectorAll('div')].some((view) => view.style.backgroundColor === 'rgba(248, 246, 250, 0.8)')).toBe(true);
  mockPerformance = true; act(render);
  expect(blurred()).toHaveLength(0);
  act(() => container.querySelector('button').click());
  expect(onClick).toHaveBeenCalledTimes(2);
});
