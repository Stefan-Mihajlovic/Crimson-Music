import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NetworkProvider, useNetwork } from '../src/providers/network-provider';
import EntryScreen from '../src/app/index';
import OfflineModeBanner from '../src/components/offline-mode-banner';

const mockRedirect = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: ({ href }) => { mockRedirect(href); return null; },
  useRouter: () => ({ push: jest.fn() }),
  useSegments: () => ['(app)', '(home)'],
}));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { uid: 'cached-listener' }, onboardingComplete: true }) }));
jest.mock('../src/providers/download-provider', () => ({ useDownloads: () => ({ downloadedCount: 3, ready: false }) }));
jest.mock('../src/components/glass-pressable', () => ({ __esModule: true, default: require('react-native').Pressable }));
jest.mock('../src/components/app-symbol', () => ({ SymbolView: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));

jest.mock('@react-native-community/netinfo', () => ({
  configure: jest.fn(), addEventListener: jest.fn(), refresh: jest.fn(),
}));
const configuredReachability = NetInfo.configure.mock.calls[0][0];

let root;
let network;
let onNetwork;
let onAppState;
let removeNetwork;
let removeAppState;
let stateDescriptor;
function Probe() { const value = useNetwork(); React.useEffect(() => { network = value; }, [value]); return null; }
async function mount(withScreens = false) {
  await act(async () => { root = create(<NetworkProvider><Probe />{withScreens && <><EntryScreen /><OfflineModeBanner /></>}</NetworkProvider>); });
}
async function networkChange(isConnected, isInternetReachable = isConnected, type) {
  await act(async () => onNetwork({ isConnected, isInternetReachable, type }));
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

test('NetInfo does not manufacture a failed reachability check during inactive startup', async () => {
  // Exercise the installed NetInfo implementation that used to turn our
  // AppState-based reachabilityShouldRun=false into isInternetReachable=false.
  const Reachability = jest.requireActual('@react-native-community/netinfo/lib/commonjs/internal/internetReachability').default;
  const defaults = jest.requireActual('@react-native-community/netinfo/lib/commonjs/internal/defaultConfiguration').default;
  AppState.currentState = 'inactive';
  const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 200 });
  const onReachability = jest.fn();
  const checker = new Reachability({ ...defaults, ...configuredReachability }, onReachability);
  try {
    await act(async () => checker.update({ type: 'wifi', isConnected: true }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(onReachability.mock.calls.flat()).not.toContain(false);
    expect(onReachability).toHaveBeenLastCalledWith(true);
    expect(await configuredReachability.reachabilityTest({ status: 503 })).toBe(true);
  } finally {
    checker.tearDown();
  }
});

test('online startup and foreground keep the home route without an offline loading banner', async () => {
  AppState.currentState = 'inactive';
  NetInfo.refresh.mockImplementation(async () => onNetwork({ type: 'wifi', isConnected: true, isInternetReachable: true }));
  await mount(true);
  await networkChange(true, false, 'wifi');
  await appChange('active');
  await appChange('background');
  await networkChange(true, false, 'wifi');
  await appChange('active');
  expect(mockRedirect.mock.calls.map(([href]) => href)).toEqual(['/(app)/(home)']);
  expect(root.root.findAllByProps({ accessibilityLabel: 'Offline mode. 3 songs available.' })).toHaveLength(0);
  // Confirmed loss of connection still exposes saved music without waiting.
  await networkChange(false, false, 'none');
  expect(mockRedirect).toHaveBeenLastCalledWith('/(app)/(home)/offline-listening?auto=1');
  expect(root.root.findAllByProps({ accessibilityLabel: 'Offline mode. 3 songs available.' }).length).toBeGreaterThan(0);
});

test('uninitialized native false snapshots do not enable offline mode', async () => {
  await mount();
  await networkChange(false, false, 'unknown');
  expect(network).toEqual({ isOffline: false, ready: true });
  await networkChange(true, null, 'wifi');
  expect(network.isOffline).toBe(false);
  await networkChange(true, true, 'wifi');
  expect(network.isOffline).toBe(false);
  expect(NetInfo.refresh).not.toHaveBeenCalled();
});

test('background failures do not flash offline on resume while a fresh check is pending', async () => {
  let finish;
  NetInfo.refresh.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await mount();
  await networkChange(true);
  await appChange('background');
  await networkChange(true, false);
  expect(network.isOffline).toBe(false);
  await appChange('active');
  await networkChange(true, null);
  expect(network.isOffline).toBe(false);
  await networkChange(true);
  await act(async () => finish());
  expect(network.isOffline).toBe(false);
});

test('a real foreground disconnection applies immediately and pending reconnection does not clear it', async () => {
  await mount();
  await networkChange(false, false, 'none');
  expect(network.isOffline).toBe(true);
  await networkChange(true, null, 'wifi');
  expect(network.isOffline).toBe(true);
  await networkChange(true, false, 'wifi');
  expect(network.isOffline).toBe(true);
  await networkChange(true, true, 'wifi');
  expect(network.isOffline).toBe(false);
});

test('foreground supersedes a pending old refresh without accepting its stale result', async () => {
  let finishOld;
  NetInfo.refresh.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
  NetInfo.refresh.mockImplementationOnce(async () => onNetwork({ isConnected: true, isInternetReachable: true }));
  await mount();
  await networkChange(true);
  await appChange('inactive');
  await appChange('active');
  await appChange('background');
  await appChange('active');
  await networkChange(true, false);
  expect(network.isOffline).toBe(false);
  await act(async () => finishOld());
  expect(NetInfo.refresh).toHaveBeenCalledTimes(2);
  expect(network.isOffline).toBe(false);
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
