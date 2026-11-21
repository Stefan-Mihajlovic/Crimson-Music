import React, { Profiler } from 'react';
import { AppState } from 'react-native';
import { act, create } from 'react-test-renderer';
import VaultArtwork from '../src/components/vault-artwork';
let mockFocused = true;
let mockSettings = {};
let mockReaction;
const mockStart = jest.fn(async () => {});
const mockStop = jest.fn(async () => {});
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => mockSettings }));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (callback, ...args) => callback(...args) }));
jest.mock('react-native-reanimated', () => ({ useAnimatedReaction: (_read, react) => { mockReaction = react; } }));
jest.mock('expo-image', () => ({ Image: require('react').forwardRef((props, ref) => {
  require('react').useImperativeHandle(ref, () => ({ startAnimating: mockStart, stopAnimating: mockStop }));
  return require('react').createElement('Image', props);
}) }));
let root, subscription, appChanged;
const offset = { value: 0 };
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; mockFocused = true; mockSettings = {}; AppState.currentState = 'active';
  subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { appChanged = callback; return { remove() {} }; });
});
afterEach(async () => { await act(async () => root.unmount()); subscription.mockRestore(); });

test('Vault stops its decoder offscreen, behind another route, and in the background', async () => {
  await act(async () => { root = create(<VaultArtwork scrollOffset={offset} bottom={300} />); });
  expect(mockStart).toHaveBeenCalled();
  mockStop.mockClear();
  await act(async () => mockReaction(false, true));
  expect(mockStop).toHaveBeenCalled();
  await act(async () => mockReaction(true, false));
  mockStop.mockClear();
  mockFocused = false;
  await act(async () => root.update(<VaultArtwork scrollOffset={offset} bottom={301} />));
  expect(mockStop).toHaveBeenCalled();
  mockFocused = true;
  await act(async () => root.update(<VaultArtwork scrollOffset={offset} bottom={302} />));
  mockStop.mockClear();
  await act(async () => appChanged('background'));
  expect(mockStop).toHaveBeenCalled();
  mockStart.mockClear();
  await act(async () => root.root.findByType('Image').props.onLoad());
  expect(mockStart).not.toHaveBeenCalled();
});

test('scrolling within the visible range creates no additional React commits', async () => {
  const render = jest.fn();
  await act(async () => { root = create(<Profiler id="vault" onRender={render}><VaultArtwork scrollOffset={offset} bottom={300} /></Profiler>); });
  render.mockClear();
  for (let i = 0; i < 100; i++) await act(async () => mockReaction(true, true));
  expect(render).not.toHaveBeenCalled();
});
