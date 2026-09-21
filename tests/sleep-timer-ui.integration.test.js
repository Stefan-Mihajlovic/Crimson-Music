import React from 'react';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import { Platform, ScrollView, Text } from 'react-native';
import SleepTimerSheet from '../src/components/sleep-timer-sheet';
import { inactiveSleepTimer, SleepTimerController } from '../src/services/sleep-timer';

jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'Symbol' }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { text: '#FFF', accent: '#ABC', secondaryText: '#AAA', controlSurface: '#222', border: '#333' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 34 }) }));
let tree;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; jest.useFakeTimers(); Platform.OS = 'ios'; });
afterEach(() => { if (tree) act(() => tree.unmount()); tree = undefined; jest.useRealTimers(); Platform.OS = 'ios'; });
const options = () => ({ timer: inactiveSleepTimer, currentSongTitle: 'Current song', onStartMinutes: jest.fn(), onEndCurrentSong: jest.fn(), onCancel: jest.fn(), onClose: jest.fn() });
const button = (label) => tree.root.findAllByProps({ accessibilityLabel: label }).find((node) => typeof node.props.onPress === 'function');

test('iOS heading and every timer choice share one native scroll view; choosing one invokes the model callback', () => {
  const props = options();
  act(() => { tree = create(<SleepTimerSheet {...props} />); });
  const scroll = tree.root.findByType(ScrollView);
  expect(scroll.findAllByType(Text).some((node) => node.props.children === 'Sleep timer')).toBe(true);
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe('never');
  expect(tree.root.findAllByType(ScrollView)).toHaveLength(1);
  for (const minutes of [5, 15, 30, 45, 60, 90]) act(() => button(`${minutes} minutes`).props.onPress());
  expect(props.onStartMinutes.mock.calls).toEqual([[5], [15], [30], [45], [60], [90]]);
  act(() => button('End of current song').props.onPress());
  expect(props.onEndCurrentSong).toHaveBeenCalledTimes(1);
});

test('countdown updates locally while its stable timer state stays unchanged; cancel and Done work', () => {
  const controller = new SleepTimerController({ onExpire: jest.fn() });
  const props = { ...options(), timer: controller.startMinutes(5) };
  const snapshot = props.timer;
  act(() => { tree = create(<SleepTimerSheet {...props} />); });
  expect(tree.root.findAllByType(Text).some((node) => node.props.children === '5:00 remaining')).toBe(true);
  act(() => jest.advanceTimersByTime(2_000));
  expect(tree.root.findAllByType(Text).some((node) => node.props.children === '4:58 remaining')).toBe(true);
  expect(controller.getSnapshot()).toBe(snapshot);
  expect(button('5 minutes').props.accessibilityState.selected).toBe(true);
  act(() => button('Cancel sleep timer').props.onPress());
  act(() => button('Close sleep timer').props.onPress());
  expect(props.onCancel).toHaveBeenCalledTimes(1); expect(props.onClose).toHaveBeenCalledTimes(1);
  controller.dispose();
});

test.each(['ios', 'android', 'web'])('%s disables end-of-song when there is no current song', (platform) => {
  Platform.OS = platform;
  act(() => { tree = create(<SleepTimerSheet {...options()} currentSongTitle={null} />); });
  expect(button('End of current song').props.disabled).toBe(true);
  expect(button('Cancel sleep timer')).toBeUndefined();
});
