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
