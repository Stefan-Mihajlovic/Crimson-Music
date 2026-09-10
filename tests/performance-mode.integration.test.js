import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';

import NativeClearGlassCircle from '../src/components/clear-glass-circle.ios';
import ClearGlassCircle from '../src/components/clear-glass-circle.tsx';
import GlassPressable from '../src/components/glass-pressable';
import LiquidSearchField from '../src/components/liquid-search-field.ios';
import NativeButton from '../src/components/native-button.ios';
import NativeBackButton from '../src/components/native-back-button.ios';
import PerformanceStackHeader from '../src/components/performance-stack-header';

let mockPerformanceMode;
const mockColors = {
  elevated: '#17141C', background: '#0E0D13', surface: '#211B29', surfaceStrong: '#30283A', border: '#42394D',
  controlSurface: 'rgba(23,20,28,0.68)',
  text: '#F3EEFF', mutedText: '#817A8D', accent: '#9B68FA',
};
jest.mock('../src/providers/settings-provider', () => ({
  useAppSettings: () => ({ colors: mockColors, isDark: true, performanceMode: mockPerformanceMode, reduceMotion: false }),
}));
jest.mock('../src/hooks/use-voice-search', () => ({
  useVoiceSearch: () => ({ listening: false, stop: jest.fn(), toggle: jest.fn() }),
}));
jest.mock('expo-glass-effect', () => ({ GlassView: 'ExpoGlassView' }));
jest.mock('expo-symbols', () => ({ SymbolView: 'SymbolView' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, left: 0, right: 0, bottom: 34 }) }));
jest.mock('@expo/ui/swift-ui', () => {
  const React = require('react');
  const TextField = React.forwardRef((props, ref) => React.createElement('TextField', { ...props, ref }));
  TextField.displayName = 'MockTextField';
  TextField.Placeholder = 'TextFieldPlaceholder';
  return {
    Button: 'NativeButton', Ellipse: 'Ellipse', Host: 'Host', HStack: 'HStack', Image: 'NativeImage',
    GlassEffectContainer: 'GlassEffectContainer', Namespace: 'Namespace', Text: 'NativeText', TextField,
    useNativeState: (initial) => {
      const value = React.useRef(initial);
      return React.useMemo(() => ({ get: () => value.current, set: (next) => { value.current = next; } }), []);
    },
  };
});
jest.mock('@expo/ui/swift-ui/modifiers', () => {
  const names = [
    'accessibilityIdentifier', 'accessibilityLabel', 'animation', 'autocorrectionDisabled', 'background',
    'buttonBorderShape', 'buttonStyle', 'controlSize', 'disabled', 'font', 'foregroundStyle', 'frame',
    'glassEffect', 'glassEffectId', 'labelStyle', 'padding', 'shadow', 'submitLabel', 'textFieldStyle', 'overlay', 'stroke', 'strokeBorder',
    'textInputAutocapitalization', 'tint',
  ];
  return {
    ...Object.fromEntries(names.map((name) => [name, (...args) => ({ name, args })])),
    Animation: { spring: (options) => options }, shapes: { capsule: () => 'capsule', circle: () => 'circle' },
  };
});

let root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockPerformanceMode = false;
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

async function render(element) {
  await act(async () => { root = create(element); });
}
async function setPerformance(enabled, element) {
  mockPerformanceMode = enabled;
  await act(async () => root.update(element));
}
function glassModifiers() {
  return root.root.findAll((node) => node.props?.modifiers?.some((modifier) => (
    modifier.name.startsWith('glass') || (modifier.name === 'buttonStyle' && modifier.args[0].startsWith('glass'))
  )));
}

test.each([
  ['iOS', NativeClearGlassCircle],
  ['cross-platform', ClearGlassCircle],
])('%s icon circle always matches the Settings surface', async (_, Circle) => {
  const element = () => React.createElement(Circle, { size: 96 });
  await render(element());
  for (const enabled of [false, true, false]) {
    await setPerformance(enabled, element());
    expect(root.root.findAllByType('ExpoGlassView')).toHaveLength(0);
    expect(glassModifiers()).toHaveLength(0);
    expect(StyleSheet.flatten(root.toJSON().props.style)).toMatchObject({
      width: 96, height: 96, borderRadius: 48, backgroundColor: mockColors.controlSurface,
      borderColor: mockColors.border, borderWidth: StyleSheet.hairlineWidth,
    });
  }
});

test('solid controls stay actionable through Performance Mode changes', async () => {
  const onPress = jest.fn();
  const onLongPress = jest.fn();
  const element = () => React.createElement(GlassPressable, {
    accessibilityLabel: 'Play mix', onPress, onLongPress,
  }, React.createElement(Text, null, 'Play'));
  await render(element());
  for (const enabled of [false, true, false]) {
    await setPerformance(enabled, element());
    expect(glassModifiers()).toHaveLength(0);
    const button = root.root.findAll((node) => node.props.accessibilityLabel === 'Play mix' && typeof node.props.style === 'function')[0];
    expect(StyleSheet.flatten(button.props.style({ pressed: false }))).toMatchObject({
      backgroundColor: mockColors.controlSurface, borderColor: mockColors.border,
      borderWidth: StyleSheet.hairlineWidth,
    });
    await act(async () => button.props.onPress());
  }
  await act(async () => root.root.findAll((node) => node.props.accessibilityLabel === 'Play mix' && typeof node.props.style === 'function')[0].props.onLongPress());
  expect(onPress).toHaveBeenCalledTimes(3);
  expect(onLongPress).toHaveBeenCalledTimes(1);
});

test('solid search preserves native input, external values, and cancellation', async () => {
  const onChangeText = jest.fn();
  const element = (value = '') => React.createElement(LiquidSearchField, { value, placeholder: 'Search Audius', onChangeText });
  await render(element());
  await act(async () => root.root.findByType('TextField').props.onFocusChange(true));
  for (const enabled of [false, true, false]) {
    await setPerformance(enabled, element('Jazz'));
    expect(root.root.findAllByType('GlassEffectContainer')).toHaveLength(0);
    expect(glassModifiers()).toHaveLength(0);
    expect(root.root.findByType('TextField').props.text.get()).toBe('Jazz');
    await act(async () => root.root.findByType('TextField').props.onTextChange('Audius'));
    expect(onChangeText).toHaveBeenCalledWith('Audius');
  }
  await act(async () => root.root.findByProps({ systemName: 'xmark' }).props.onPress());
  expect(onChangeText).toHaveBeenLastCalledWith('');
  expect(root.root.findByType('TextField').props.text.get()).toBe('');
});

test('action buttons use solid surfaces while navigation retains its glass exception', async () => {
  const onPress = jest.fn();
  const element = () => React.createElement(React.Fragment, null,
    React.createElement(NativeButton, { label: 'Continue', onPress }),
    React.createElement(NativeBackButton, { onPress }),
  );
  await render(element());
  expect(glassModifiers()).toHaveLength(1);
  expect(glassModifiers()[0].props.label).toBe('Go back');
  await setPerformance(true, element());
  expect(glassModifiers()).toHaveLength(0);
  for (const button of root.root.findAllByType('NativeButton')) await act(async () => button.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(2);
});

test('opaque navigation header preserves title and back navigation without a native glass control', async () => {
  const goBack = jest.fn();
  await render(React.createElement(PerformanceStackHeader, {
    back: { title: 'Account' }, navigation: { goBack }, options: { title: 'Listening History' }, route: { name: 'history' },
  }));
  expect(root.root.findByProps({ accessibilityRole: 'header' }).props.children).toBe('Listening History');
  expect(glassModifiers()).toHaveLength(0);
  expect(root.root.findAllByType('NativeButton')).toHaveLength(0);
  await act(async () => root.root.findByProps({ accessibilityLabel: 'Go back', accessibilityRole: 'button' }).props.onPress());
  expect(goBack).toHaveBeenCalledTimes(1);
});
