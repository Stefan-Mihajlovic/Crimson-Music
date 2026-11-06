import React, { Profiler } from 'react';
import { act, create } from 'react-test-renderer';
import { withTiming, cancelAnimation } from 'react-native-reanimated';
import { StyleSheet } from 'react-native';
import PlayerVisualizer from '../src/components/player-visualizer';
import { createValueStore } from '../src/services/value-store';

let mockStore;
jest.mock('../src/providers/player-provider', () => ({ usePlayerVisualizerStore: () => mockStore }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Circle: 'Circle', Defs: 'Defs', LinearGradient: 'SvgLinearGradient', Path: 'Path', RadialGradient: 'RadialGradient', Rect: 'Rect', Stop: 'Stop' }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: 'AnimatedView' },
  useSharedValue: (initial) => require('react').useRef({ value: initial, set(next) { this.value = next; } }).current,
  useAnimatedStyle: (callback) => callback(),
  withTiming: jest.fn((value) => value), cancelAnimation: jest.fn(), Easing: { linear: 'linear' },
}));
let root;
const colors = ['#30084B', '#92106A', '#570C8F'];
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mockStore = createValueStore(Array(16).fill(0)); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = undefined; });

test.each(['aurora', 'spectrum', 'orbit', 'tides', 'prism'])('%s handles 100 audio packets without a React update commit', async (style) => {
  const onRender = jest.fn();
  await act(async () => { root = create(<Profiler id="visualizer" onRender={onRender}><PlayerVisualizer colors={colors} style={style} width={402} height={874} /></Profiler>); });
  onRender.mockClear(); withTiming.mockClear();
  expect(mockStore.hasSubscribers()).toBe(true);
  for (let i = 0; i < 100; i++) {
    await act(async () => mockStore.publish(Array.from({ length: 16 }, (_, band) => ((band + i) % 10) / 10)));
  }
  expect(onRender).not.toHaveBeenCalled();
  expect(withTiming).toHaveBeenCalledTimes(100);
  await act(async () => mockStore.publish(Array(16).fill(0)));
  expect(withTiming.mock.calls.at(-1)[0]).toEqual(Array(20).fill(0));
  await act(async () => root.unmount());
  root = undefined;
  expect(mockStore.hasSubscribers()).toBe(false);
  expect(cancelAnimation).toHaveBeenCalled();
});

test('Orbit stays centered on the artwork after a change in player layout', async () => {
  const props = { colors, style: 'orbit', width: 402, height: 874 };
  let artworkLayout = { x: 22, y: 141, size: 358 };
  await act(async () => { root = create(<PlayerVisualizer {...props} artworkLayout={artworkLayout} />); });
  const checkCenter = () => {
    for (let index = 0; index < 3; index++) {
      const ring = root.root.findByProps({ testID: `orbit-ring-${index}` });
      const layout = StyleSheet.flatten(ring.props.style);
      expect(layout.left + layout.width / 2).toBe(artworkLayout.x + artworkLayout.size / 2);
      expect(layout.top + layout.height / 2).toBe(artworkLayout.y + artworkLayout.size / 2);
    }
  };
  checkCenter();
  artworkLayout = { x: 40, y: 60, size: 260 };
  await act(async () => root.update(<PlayerVisualizer {...props} width={874} height={402} artworkLayout={artworkLayout} />));
  checkCenter();
});
