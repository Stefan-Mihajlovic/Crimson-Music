import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { BlurView } from 'expo-blur';
import { FrostedBackdrop, FrostedLayer } from '../../src/components/frosted-surface';

let mockPerformance = false;
jest.mock('../../src/providers/settings-provider', () => ({ useAppSettings: () => ({ performanceMode: mockPerformance, isDark: true, colors: { elevated: '#201A2A', border: '#333', accent: '#95f' } }) }));
jest.mock('expo-blur', () => {
  const React = require('react');
  return {
    BlurView: 'Blur',
    BlurTargetView: React.forwardRef((props, ref) => <mock-target {...props} ref={ref} />),
  };
});
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
let root;
function Example() {
  return <FrostedLayer background={<mock-artwork />} style={{ flex: 1 }}><FrostedBackdrop /></FrostedLayer>;
}
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mockPerformance = false; });
afterEach(() => act(() => root?.unmount()));

test('waits for an attached Android target, then blurs its sibling without capturing itself', () => {
  const nativeTarget = { nativeTag: 10 };
  act(() => { root = create(<Example />, { createNodeMock: (element) => element.type === 'mock-target' ? nativeTarget : null }); });
  expect(root.root.findAllByType(BlurView)).toHaveLength(0);
  const target = root.root.findByType('mock-target');
  act(() => target.props.onLayout());
  expect(root.root.findByType(BlurView).props).toMatchObject({ blurTarget: { current: nativeTarget }, blurMethod: 'dimezisBlurView' });
  expect(target.findAllByType(BlurView)).toHaveLength(0);
  mockPerformance = true;
  act(() => root.update(<Example />));
  expect(root.root.findAllByType(BlurView)).toHaveLength(0);
});

test('an inner capture layer keeps its background blur on the outer, separate target', () => {
  let id = 0;
  act(() => { root = create(<FrostedLayer background={<mock-artwork />}><FrostedLayer background={<FrostedBackdrop />}><FrostedBackdrop /></FrostedLayer></FrostedLayer>, { createNodeMock: (element) => element.type === 'mock-target' ? { id: ++id } : null }); });
  const targets = root.root.findAllByType('mock-target');
  act(() => { targets.forEach((target) => target.props.onLayout()); });
  const blurs = root.root.findAllByType(BlurView);
  expect(blurs).toHaveLength(2);
  expect(blurs[0].props.blurTarget.current).not.toBe(blurs[1].props.blurTarget.current);
  expect(targets[0].findAllByType(BlurView)).toHaveLength(0);
  expect(targets[1].findAllByType(BlurView)).toHaveLength(1);
});
