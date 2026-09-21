import { afterEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SettingsProvider, useAppSettings } from '../src/providers/settings-provider';
import { getDataSaverEnabled, setDataSaverEnabled } from '../src/services/data-usage';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

let root;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
  setDataSaverEnabled(false);
});

test('screens mount only after saved data and performance preferences are applied to network policy', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let restore;
  AsyncStorage.getItem.mockReturnValueOnce(new Promise((resolve) => { restore = resolve; }));
  const mountedSettings = [];
  function Probe() {
    const settings = useAppSettings();
    mountedSettings.push([settings.dataSaver, settings.performanceMode, getDataSaverEnabled()]);
    return null;
  }
  await act(async () => { root = create(React.createElement(SettingsProvider, null, React.createElement(Probe))); });
  expect(mountedSettings).toEqual([]);
  await act(async () => restore(JSON.stringify({ dataSaver: true, performanceMode: true })));
  expect(mountedSettings).toEqual([[true, true, true]]);
});

test('unavailable settings storage does not leave the app stuck on its splash screen', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  AsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage unavailable'));
  let mounted = false;
  function Probe() { mounted = true; return null; }
  await act(async () => { root = create(React.createElement(SettingsProvider, null, React.createElement(Probe))); });
  expect(mounted).toBe(true);
  expect(getDataSaverEnabled()).toBe(false);
});

test('crossfade defaults off and restores a bounded duration without enabling itself', async () => {
  await AsyncStorage.clear();
  let settings;
  function Probe() { settings = useAppSettings(); return null; }
  await act(async () => { root = create(React.createElement(SettingsProvider, null, React.createElement(Probe))); });
  expect(settings.crossfadeEnabled).toBe(false);
  expect(settings.crossfadeSeconds).toBe(3);
  await act(async () => settings.updateSettings({ crossfadeEnabled: true, crossfadeSeconds: 40 }));
  expect(settings.crossfadeSeconds).toBe(12);
  await act(async () => root.unmount());
  await act(async () => { root = create(React.createElement(SettingsProvider, null, React.createElement(Probe))); });
  expect(settings.crossfadeEnabled).toBe(true);
  expect(settings.crossfadeSeconds).toBe(12);
  await act(async () => settings.updateSettings({ crossfadeEnabled: false }));
  expect(settings.crossfadeSeconds).toBe(12);
});

test('the original six-second default migrates to three while newly chosen durations survive restart', async () => {
  await AsyncStorage.setItem('crimson.settings.v1', JSON.stringify({ crossfadeEnabled: true, crossfadeSeconds: 6 }));
  let settings;
  function Probe() { settings = useAppSettings(); return null; }
  const render = async () => act(async () => { root = create(React.createElement(SettingsProvider, null, React.createElement(Probe))); });
  await render();
  expect(settings.crossfadeEnabled).toBe(true);
  expect(settings.crossfadeSeconds).toBe(3);
  await act(async () => settings.updateSettings({ crossfadeSeconds: 6 }));
  await act(async () => root.unmount());
  await render();
  expect(settings.crossfadeSeconds).toBe(6);
});


test('speed, pitch and normalization persist across app launches', async () => {
  await AsyncStorage.clear();
  let settings;
  function Probe() { settings = useAppSettings(); return null; }
  const render = async () => act(async () => { root = create(React.createElement(SettingsProvider, null, React.createElement(Probe))); });
  await render();
  expect([settings.playbackSpeed, settings.preservePitch, settings.loudnessNormalization]).toEqual([1, true, false]);
  await act(async () => settings.updateSettings({ playbackSpeed: 1.25, preservePitch: false, loudnessNormalization: true }));
  await act(async () => root.unmount());
  await render();
  expect([settings.playbackSpeed, settings.preservePitch, settings.loudnessNormalization]).toEqual([1.25, false, true]);
});
