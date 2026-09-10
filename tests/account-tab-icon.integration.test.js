import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { NativeModules } from 'react-native';
import { useAccountTabIcon } from '../src/hooks/use-account-tab-icon';
import { useAuth } from '../src/providers/auth-provider';
import { reportError } from '../src/services/telemetry';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return Object.defineProperties(Object.create(actual), {
    Image: { value: { resolveAssetSource: jest.fn((source) => source) } },
    NativeModules: { value: { ...actual.NativeModules, CrimsonRemoteControls: {
      accountTabFallbackIcon: 'data:image/png;base64,circular-native-placeholder',
      createCircularTabIcon: jest.fn(),
    } } },
  });
});
jest.mock('../src/components/profile-images', () => ({ profileImageSource: (photo) => ({ uri: photo === '1' ? 'file:///assets/profile-1.png' : photo }) }));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: jest.fn() }));
jest.mock('../src/services/telemetry', () => ({ reportError: jest.fn() }));

let root;
let icon;
function Probe() {
  const currentIcon = useAccountTabIcon();
  React.useEffect(() => { icon = currentIcon; }, [currentIcon]);
  return null;
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
  return { promise, resolve, reject };
}
const native = NativeModules.CrimsonRemoteControls;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test('native tabs never receive the uncropped remote source before the circular PNG is ready', async () => {
  const preparation = deferred();
  useAuth.mockReturnValue({ user: { uid: 'one', ProfilePhoto: 'https://audius.example/avatar-one.jpg' } });
  native.createCircularTabIcon.mockReturnValueOnce(preparation.promise);
  await act(async () => { root = create(React.createElement(Probe)); });
  expect(native.createCircularTabIcon).toHaveBeenCalledWith('https://audius.example/avatar-one.jpg');
  expect(icon.uri).toBe(native.accountTabFallbackIcon);
  await act(async () => preparation.resolve('file:///cache/circular-one.png'));
  expect(icon).toEqual({ uri: 'file:///cache/circular-one.png', width: 28, height: 28, scale: 3 });
});

test('a failed download keeps a round fallback instead of restoring square edges', async () => {
  useAuth.mockReturnValue({ user: { uid: 'two', ProfilePhoto: 'https://audius.example/unavailable.webp' } });
  const failure = new Error('Avatar unavailable');
  native.createCircularTabIcon.mockRejectedValueOnce(failure);
  await act(async () => { root = create(React.createElement(Probe)); });
  expect(icon.uri).toBe(native.accountTabFallbackIcon);
  expect(reportError).toHaveBeenCalledWith(failure, 'account.tab-icon');
});

test('a previous account’s delayed thumbnail cannot replace the current profile', async () => {
  const old = deferred();
  const current = deferred();
  useAuth.mockReturnValue({ user: { uid: 'old', ProfilePhoto: 'https://audius.example/old.webp' } });
  native.createCircularTabIcon.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  await act(async () => { root = create(React.createElement(Probe)); });
  useAuth.mockReturnValue({ user: { uid: 'current', ProfilePhoto: 'https://audius.example/current.webp' } });
  await act(async () => { root.update(React.createElement(Probe)); });
  await act(async () => old.resolve('file:///cache/old.png'));
  expect(icon.uri).toBe(native.accountTabFallbackIcon);
  await act(async () => current.resolve('file:///cache/current.png'));
  expect(icon.uri).toBe('file:///cache/current.png');
});

test('bundled profile presets also pass through the native circular renderer', async () => {
  useAuth.mockReturnValue({ user: { uid: 'preset', ProfilePhoto: '1' } });
  native.createCircularTabIcon.mockResolvedValueOnce('file:///cache/preset-circle.png');
  await act(async () => { root = create(React.createElement(Probe)); });
  expect(native.createCircularTabIcon).toHaveBeenCalledWith('file:///assets/profile-1.png');
  expect(icon.uri).toBe('file:///cache/preset-circle.png');
});
