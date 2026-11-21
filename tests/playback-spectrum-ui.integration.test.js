import React, { Profiler } from 'react';
import { act, create } from 'react-test-renderer';
import { NowPlayingOverlay } from '../src/components/now-playing-artwork';
import { createValueStore } from '../src/services/value-store';
let mockStore;
let mockSettings;
jest.mock('../src/components/artwork-image', () => 'ArtworkImage');
jest.mock('../src/providers/player-provider', () => ({ usePlayerSpectrumStore: () => mockStore }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => mockSettings }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: 'AnimatedView' },
  useSharedValue: (initial) => require('react').useRef({ value: initial, set(value) { this.value = value; } }).current,
  useAnimatedStyle: (callback) => callback(), withTiming: (value) => value, cancelAnimation: jest.fn(),
}));
let root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mockSettings = {}; mockStore = createValueStore([0.2, 0.3, 0.4, 0.5]); });
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test('200 audio packets animate the active artwork without any React commits, then unsubscribe', async () => {
  const render = jest.fn();
  await act(async () => { root = create(<Profiler id="artwork" onRender={render}><NowPlayingOverlay active /></Profiler>); });
  render.mockClear();
  expect(mockStore.hasSubscribers()).toBe(true);
  for (let i = 0; i < 200; i++) await act(async () => mockStore.publish([0.2, (i % 10) / 10, 0.6, 0.8]));
  expect(render).not.toHaveBeenCalled();
  await act(async () => root.update(<NowPlayingOverlay active={false} />));
  expect(mockStore.hasSubscribers()).toBe(false);
});

test.each(['reduceMotion', 'performanceMode'])('%s stops audio-driven artwork work', async (setting) => {
  mockSettings = { [setting]: true };
  await act(async () => { root = create(<NowPlayingOverlay active />); });
  expect(mockStore.hasSubscribers()).toBe(false);
});
