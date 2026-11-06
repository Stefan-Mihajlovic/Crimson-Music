import React from 'react';
import { act, create } from 'react-test-renderer';
import { Platform, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlaybackSpeedSheet from '../src/components/playback-speed-sheet';
import VisualizerSheet from '../src/components/visualizer-sheet';
import { SettingsProvider, useAppSettings } from '../src/providers/settings-provider';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'Symbol' }));
jest.mock('../src/components/visualizer-icon', () => 'VisualizerIcon');
jest.mock('../src/components/app-switch', () => 'Switch');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 34 }) }));
let root, settings;
function Probe() { settings = useAppSettings(); return null; }
const mount = async (component) => act(async () => { root = create(<SettingsProvider><Probe />{component}</SettingsProvider>); });
const button = (label) => root.root.findAll((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const slider = () => root.root.findAll((node) => node.props.accessibilityRole === 'adjustable' && typeof node.props.onResponderGrant === 'function')[0];
beforeEach(async () => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; Platform.OS = 'ios'; await AsyncStorage.clear(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; Platform.OS = 'ios'; });

test('quick speed choices, reset and pitch controls immediately change the saved playback settings', async () => {
  const close = jest.fn();
  await mount(<PlaybackSpeedSheet onClose={close} />);
  expect(root.root.findByType(ScrollView).findAllByProps({ accessibilityRole: 'header' }).length).toBeGreaterThan(0);
  await act(async () => button('1.25× speed').props.onPress());
  expect(settings.playbackSpeed).toBe(1.25);
  expect(button('1.25× speed').props.accessibilityState.checked).toBe(true);
  await act(async () => root.root.findByType('Switch').props.onValueChange(false));
  expect(settings.preservePitch).toBe(false);
  await act(async () => button('Reset to normal speed').props.onPress());
  expect(settings.playbackSpeed).toBe(1);
  expect(button('Normal speed, 1×').props.accessibilityState.checked).toBe(true);
  expect(JSON.parse(await AsyncStorage.getItem('crimson.settings.v1')).playbackSpeed).toBe(1);
  await act(async () => button('Close playback speed').props.onPress());
  expect(close).toHaveBeenCalledTimes(1);
});

test('dragging previews a precise speed and commits once on release; cancellation restores the saved speed', async () => {
  await mount(<PlaybackSpeedSheet onClose={jest.fn()} />);
  await act(async () => slider().props.onLayout({ nativeEvent: { layout: { width: 328 } } }));
  AsyncStorage.setItem.mockClear();
  await act(async () => slider().props.onResponderGrant({ nativeEvent: { locationX: 164 } }));
  expect(slider().props.accessibilityValue.now).toBe(1.25);
  await act(async () => slider().props.onResponderMove({ nativeEvent: { locationX: 174 } }));
  expect(slider().props.accessibilityValue.now).toBe(1.3);
  expect(settings.playbackSpeed).toBe(1);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await act(async () => slider().props.onResponderRelease());
  expect(settings.playbackSpeed).toBe(1.3);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  await act(async () => slider().props.onResponderGrant({ nativeEvent: { locationX: -50 } }));
  expect(slider().props.accessibilityValue.now).toBe(0.5);
  await act(async () => slider().props.onResponderTerminate());
  expect(slider().props.accessibilityValue.now).toBe(1.3);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
});

test('slider accessibility actions clamp to supported limits and preserve the exact step', async () => {
  await mount(<PlaybackSpeedSheet onClose={jest.fn()} />);
  await act(async () => button('2× speed').props.onPress());
  await act(async () => slider().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  expect(settings.playbackSpeed).toBe(2);
  await act(async () => slider().props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
  expect(settings.playbackSpeed).toBe(1.95);
  await act(async () => button('0.5× speed').props.onPress());
  await act(async () => slider().props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
  expect(settings.playbackSpeed).toBe(0.5);
});

test('web keyboard or assistive changes commit immediately, while pointer drags commit on release', async () => {
  Platform.OS = 'web';
  await mount(<PlaybackSpeedSheet onClose={jest.fn()} />);
  const input = () => root.root.findByType('input');
  await act(async () => input().props.onChange({ currentTarget: { value: '1.1' } }));
  expect(settings.playbackSpeed).toBe(1.1);
  await act(async () => input().props.onPointerDown());
  await act(async () => input().props.onChange({ currentTarget: { value: '1.6' } }));
  expect(input().props.value).toBe(1.6);
  expect(settings.playbackSpeed).toBe(1.1);
  await act(async () => input().props.onPointerUp());
  expect(settings.playbackSpeed).toBe(1.6);
});

test('visualizer chooser applies every style immediately, while Off preserves the last style', async () => {
  const close = jest.fn();
  await mount(<VisualizerSheet onClose={close} />);
  expect(button('Off').props.accessibilityState.checked).toBe(true);
  for (const name of ['Aurora', 'Spectrum', 'Orbit', 'Tides', 'Prism']) {
    await act(async () => button(name).props.onPress());
    expect(settings.visualizerEnabled).toBe(true);
    expect(settings.visualizerStyle).toBe(name.toLowerCase());
    expect(button(name).props.accessibilityState.checked).toBe(true);
  }
  await act(async () => button('Off').props.onPress());
  expect(settings.visualizerEnabled).toBe(false);
  expect(settings.visualizerStyle).toBe('prism');
  await act(async () => button('Close visualizer').props.onPress());
  expect(close).toHaveBeenCalledTimes(1);
});
