import React from 'react';
import { BackHandler, Platform, StyleSheet, Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import OnboardingScreen from '../src/app/onboarding';
import EntryScreen from '../src/app/index';
import AppLayout from '../src/app/(app)/_layout';

let mockUser;
let mockComplete;
let mockParams;
let mockOffline;
const mockSave = jest.fn();
const mockRouter = { canGoBack: () => true, back: jest.fn(), replace: jest.fn() };
jest.mock('expo-router', () => ({
  get router() { return mockRouter; },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
  Redirect: 'Redirect',
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('react-native-gesture-handler', () => ({ Gesture: { Pan: () => {
  const gesture = new Proxy({}, { get: () => () => gesture }); return gesture;
} }, GestureDetector: ({ children }) => children }));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (callback, ...args) => callback(...args) }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: require('react-native').View, Text: require('react-native').Text },
  useSharedValue: (value) => require('react').useRef({ value }).current,
  useAnimatedStyle: (callback) => callback(), useReducedMotion: () => true,
  cancelAnimation: () => undefined, Easing: {}, Extrapolation: { CLAMP: 'clamp' },
  interpolate: (_value, _input, output) => output[0], interpolateColor: (_value, _input, output) => output[0],
  withTiming: (value) => value, withSpring: (value) => value, withSequence: (value) => value, withRepeat: (value) => value,
}));
jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'SymbolView' }));
jest.mock('../src/components/bouncy-pressable', () => {
  const { Pressable } = require('react-native');
  return (props) => <Pressable {...props} />;
});
jest.mock('../src/components/brand-logo', () => () => null);
jest.mock('../src/components/frosted-surface', () => ({ FrostedLayer: ({ children }) => children }));
jest.mock('../src/components/preferences-glass', () => ({ PreferencesGlassButton: (props) => {
  const { Pressable } = require('react-native');
  return <Pressable {...props} />;
} }));
jest.mock('../src/components/app-tabs', () => 'AppTabs');
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: mockUser, onboardingComplete: mockComplete, completeOnboarding: mockSave }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ reduceMotion: true, colors: {} }) }));
jest.mock('../src/providers/network-provider', () => ({ useNetwork: () => ({ isOffline: mockOffline }) }));

let root;
let backHandlerSpy;
const initialPlatform = Platform.OS;
const control = (label) => root.root.findAll((node) => node.props.accessibilityLabel === label && (node.props.onPress || node.props.onAccessibilityTap))[0];
const next = () => control('Next');
const render = async () => { await act(async () => { root = create(<OnboardingScreen />); }); };
const press = async (label) => { await act(async () => control(label).props.onPress()); };
const finish = async () => { await act(async () => { control('Pull up to enter Crimson').props.onAccessibilityTap(); await new Promise((resolve) => setTimeout(resolve, 5)); }); };
const advance = async () => { await press('Rock'); await press('Pop'); await press('Next'); await press('Next'); };

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockUser = { uid: 'listener', FavoriteCategories: [], RecommendationStyle: 'balanced' };
  mockComplete = false;
  mockOffline = false;
  mockParams = {};
  mockSave.mockResolvedValue({ ...mockUser, OnboardingComplete: true });
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
  backHandlerSpy?.mockRestore(); backHandlerSpy = undefined;
  Platform.OS = initialPlatform;
});

test('signed-in incomplete accounts are gated at entry and the app layout, including offline entry', () => {
  expect(EntryScreen().props.href).toBe('/onboarding');
  expect(AppLayout().props.href).toBe('/onboarding');
  mockOffline = true;
  expect(EntryScreen().props.href).toBe('/onboarding');
  mockComplete = true;
  expect(EntryScreen().props.href).toContain('offline-listening');
  expect(AppLayout().type).toBe('AppTabs');
  mockOffline = false;
  expect(EntryScreen().props.href).toBe('/(app)/(home)');
});

test('first-run preferences cannot be dismissed by an edit-mode deep link', async () => {
  mockParams = { mode: 'edit' };
  await render();
  expect(control('Close music preferences')).toBeUndefined();
  expect(next().props.disabled).toBe(true);
});

test('Next is white and does not persist completion before the final action', async () => {
  await render();
  expect(StyleSheet.flatten(next().props.style({ pressed: false })).backgroundColor).toBe('#FFFFFF');
  await press('Next');
  expect(mockSave).not.toHaveBeenCalled();
  await advance();
  expect(mockSave).not.toHaveBeenCalled();
  await finish();
  expect(mockSave).toHaveBeenCalledWith(['rock', 'pop'], 'balanced');
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(home)');
});

test('saved preferences skip first-run setup while the explicit editor remains available', async () => {
  mockComplete = true;
  mockUser.FavoriteCategories = ['rock', 'pop'];
  await render();
  expect(root.root.findByType('Redirect').props.href).toBe('/(app)/(home)');
  mockParams = { mode: 'edit' };
  await act(async () => root.update(<OnboardingScreen />));
  expect(control('Close music preferences')).toBeDefined();
  expect(next().props.disabled).toBe(false);
});

test('a failed final save keeps selections available for retry', async () => {
  mockSave.mockRejectedValueOnce(new Error('storage failed'));
  await render();
  await advance();
  await finish();
  expect(mockRouter.replace).not.toHaveBeenCalled();
  expect(root.root.findAllByType(Text).some((node) => String(node.props.children).includes('could not save'))).toBe(true);
  await finish();
  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/(home)');
});

test('switching accounts discards the old draft and prevents late completion navigation', async () => {
  let resolveSave;
  mockSave.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
  await render();
  await advance();
  await finish();
  mockUser = { uid: 'other', FavoriteCategories: [], RecommendationStyle: 'balanced' };
  await act(async () => root.update(<OnboardingScreen />));
  expect(next().props.disabled).toBe(true);
  await act(async () => resolveSave({ uid: 'listener', OnboardingComplete: true }));
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

test('Android Back stays in required setup and moves backward only between its steps', async () => {
  Platform.OS = 'android';
  backHandlerSpy = jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  const back = () => backHandlerSpy.mock.calls.at(-1)[1]();
  await render();
  expect(back()).toBe(true);
  expect(mockRouter.back).not.toHaveBeenCalled();
  await press('Rock'); await press('Pop'); await press('Next');
  await act(async () => expect(back()).toBe(true));
  expect(control('Rock')).toBeDefined();
  expect(mockRouter.back).not.toHaveBeenCalled();
});
