import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsProvider, useAppSettings } from '../src/providers/settings-provider';
import { EQUALIZER_PRESETS, normalizeEqualizer } from '../src/services/equalizer';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
let root, settings;
function Probe() { settings = useAppSettings(); return null; }
const mount = () => act(async () => { root = create(React.createElement(SettingsProvider, null, React.createElement(Probe))); });
beforeEach(async () => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; await AsyncStorage.clear(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });

test('equalizer starts bypassed; preset and custom gains survive app restart and off/on', async () => {
  await mount();
  expect(settings.equalizer).toEqual({ enabled: false, preset: 'flat', bands: [0, 0, 0, 0, 0] });
  const bass = EQUALIZER_PRESETS.find((preset) => preset.id === 'bass');
  await act(async () => settings.updateSettings({ equalizer: { enabled: true, preset: bass.id, bands: [...bass.bands] } }));
  await act(async () => root.unmount());
  await mount();
  expect(settings.equalizer).toEqual({ enabled: true, preset: 'bass', bands: [...bass.bands] });
  await act(async () => settings.updateSettings({ equalizer: { enabled: true, preset: 'custom', bands: [2, 3, 1, -2, -4] } }));
  await act(async () => settings.updateSettings({ equalizer: { ...settings.equalizer, enabled: false } }));
  await act(async () => root.unmount());
  await mount();
  expect(settings.equalizer).toEqual({ enabled: false, preset: 'custom', bands: [2, 3, 1, -2, -4] });
  await act(async () => settings.updateSettings({ theme: 'Light', crossfadeEnabled: true }));
  expect(settings.equalizer.bands).toEqual([2, 3, 1, -2, -4]);
});

test('invalid stored bands cannot feed nonfinite or unbounded gains to the audio engine', async () => {
  expect(normalizeEqualizer({ enabled: true, preset: 'bass', bands: [100, -30, NaN, Infinity, '9'] }))
    .toEqual({ enabled: true, preset: 'custom', bands: [12, -12, 0, 0, 0] });
  await AsyncStorage.setItem('crimson.settings.v1', JSON.stringify({ equalizer: { enabled: true, preset: 'not-a-preset', bands: [5, 1] } }));
  await mount();
  expect(settings.equalizer).toEqual({ enabled: true, preset: 'flat', bands: [0, 0, 0, 0, 0] });
});


test('saved factory presets upgrade without replacing custom gains or enabling the equalizer', async () => {
  const legacy = { enabled: false, preset: 'bass', bands: [6, 4, 0, -1, 0] };
  const currentBass = EQUALIZER_PRESETS.find((preset) => preset.id === 'bass');
  await AsyncStorage.setItem('crimson.settings.v1', JSON.stringify({ equalizer: legacy }));
  await mount();
  expect(settings.equalizer).toEqual({ enabled: false, preset: 'bass', bands: [...currentBass.bands] });
  await act(async () => settings.updateSettings({ theme: 'Light' }));
  await act(async () => root.unmount());
  await mount();
  expect(settings.equalizer).toEqual({ enabled: false, preset: 'bass', bands: [...currentBass.bands] });
  expect(normalizeEqualizer({ ...legacy, preset: 'custom' })).toEqual({ ...legacy, preset: 'custom' });
  expect(normalizeEqualizer({ ...legacy, bands: [6, 4, 1, -1, 0] }))
    .toEqual({ enabled: false, preset: 'custom', bands: [6, 4, 1, -1, 0] });
});
