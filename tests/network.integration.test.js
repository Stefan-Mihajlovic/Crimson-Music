import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NetworkProvider, useNetwork } from '../src/providers/network-provider';

jest.mock('@react-native-community/netinfo', () => ({
  configure: jest.fn(), addEventListener: jest.fn(), refresh: jest.fn(),
}));

let root;
let network;
let onNetwork;
let onAppState;
let removeNetwork;
let removeAppState;
let stateDescriptor;
function Probe() { network = useNetwork(); return null; }
async function mount() {
  await act(async () => { root = create(React.createElement(NetworkProvider, null, React.createElement(Probe))); });
}
async function networkChange(isConnected, isInternetReachable = isConnected) {
  await act(async () => onNetwork({ isConnected, isInternetReachable }));
}
async function appChange(state) {
  AppState.currentState = state;
  await act(async () => onAppState(state));
}
async function advance(ms) { await act(async () => jest.advanceTimersByTimeAsync(ms)); }

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  root = undefined;
  stateDescriptor = Object.getOwnPropertyDescriptor(AppState, 'currentState');
  Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value: 'active' });
  removeNetwork = jest.fn();
  removeAppState = jest.fn();
  NetInfo.addEventListener.mockImplementation((listener) => { onNetwork = listener; return removeNetwork; });
  NetInfo.refresh.mockImplementation(async () => { onNetwork({ isConnected: false, isInternetReachable: false }); });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    onAppState = listener;
    return { remove: removeAppState };
  });
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  jest.restoreAllMocks();
  if (stateDescriptor) Object.defineProperty(AppState, 'currentState', stateDescriptor);
  else delete AppState.currentState;
  jest.useRealTimers();
});

test('unknown startup connectivity never gates the first screen behind a probe', async () => {
  await mount();
  expect(network).toEqual({ isOffline: false, ready: true });
  await networkChange(null, null);
  await advance(60_000);
  expect(network).toEqual({ isOffline: false, ready: true });
  expect(NetInfo.refresh).not.toHaveBeenCalled();
});

test('offline callbacks and refresh completion schedule one bounded retry sequence', async () => {
  await mount();
  await networkChange(false);
  expect(network.isOffline).toBe(true);
  await advance(4_999);
  expect(NetInfo.refresh).not.toHaveBeenCalled();
  await advance(1);
  expect(NetInfo.refresh).toHaveBeenCalledTimes(1);
  await advance(9_999);
  expect(NetInfo.refresh).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(NetInfo.refresh).toHaveBeenCalledTimes(2);
  await networkChange(true);
  await advance(120_000);
  expect(NetInfo.refresh).toHaveBeenCalledTimes(2);
  expect(network.isOffline).toBe(false);
});

test('background cancels retries and foreground immediately refreshes connectivity', async () => {
  await mount();
  await networkChange(false);
  await appChange('background');
  await advance(120_000);
  expect(NetInfo.refresh).not.toHaveBeenCalled();
  await appChange('active');
  expect(NetInfo.refresh).toHaveBeenCalledTimes(1);
  await advance(5_000);
  expect(NetInfo.refresh).toHaveBeenCalledTimes(2);
});

test('a refresh completing in background does not restart polling', async () => {
  let finish;
  NetInfo.refresh.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await mount();
  await networkChange(false);
  await advance(5_000);
  await appChange('background');
  await act(async () => finish());
  await advance(120_000);
  expect(NetInfo.refresh).toHaveBeenCalledTimes(1);
});

test('unmount removes listeners and prevents pending work from rescheduling', async () => {
  let finish;
  NetInfo.refresh.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await mount();
  await networkChange(false);
  await advance(5_000);
  await act(async () => root.unmount());
  root = undefined;
  expect(removeNetwork).toHaveBeenCalledTimes(1);
  expect(removeAppState).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  await advance(120_000);
  expect(NetInfo.refresh).toHaveBeenCalledTimes(1);
});
