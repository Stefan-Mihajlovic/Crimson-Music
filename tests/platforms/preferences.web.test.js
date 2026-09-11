import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import OnboardingScreen from '../../src/app/onboarding';

const mockSave = jest.fn();
const mockRouter = { canGoBack: () => true, back: jest.fn(), replace: jest.fn() };
jest.mock('react-native-web/dist/exports/useWindowDimensions', () => () => ({ width: 1440, height: 900, scale: 1, fontScale: 1 }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; }, useLocalSearchParams: () => ({ mode: 'edit' }), Redirect: () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('react-native-gesture-handler', () => ({ Gesture: { Pan: () => {
  const gesture = new Proxy({}, { get: () => () => gesture }); return gesture;
} }, GestureDetector: () => null }));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (callback, ...args) => callback(...args) }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: {},
  useSharedValue: (value) => require('react').useRef({ value }).current,
  useAnimatedStyle: (callback) => callback(), useReducedMotion: () => true,
  cancelAnimation: () => undefined, Easing: {}, Extrapolation: { CLAMP: 'clamp' },
  interpolate: (_value, _input, output) => output[0],
  interpolateColor: (_value, _input, output) => output[0],
  withTiming: (value) => value, withSpring: (value) => value,
  withSequence: (value) => value, withRepeat: (value) => value,
}));
jest.mock('../../src/components/app-symbol', () => ({ SymbolView: () => null }));
jest.mock('../../src/components/bouncy-pressable', () => () => null);
jest.mock('../../src/components/brand-logo', () => () => null);
jest.mock('../../src/components/frosted-surface', () => ({ FrostedLayer: () => null }));
jest.mock('../../src/components/preferences-glass', () => ({ PreferencesGlassButton: () => null, PreferencesGlassSurface: () => null }));
jest.mock('../../src/providers/auth-provider', () => ({ useAuth: () => ({
  user: { uid: 'listener', FavoriteCategories: ['rock', 'pop'], RecommendationStyle: 'balanced' },
  onboardingComplete: true, completeOnboarding: mockSave,
}) }));
jest.mock('../../src/providers/settings-provider', () => ({ useAppSettings: () => ({
  reduceMotion: true, isDark: true,
  colors: { background: '#111', elevated: '#222', text: '#fff', secondaryText: '#aaa', border: '#333', accent: '#95f', accentSoft: '#325' },
}) }));

let root;
let container;
const control = (label) => container.querySelector(`[aria-label="${label}"]`);
const saveButton = () => container.querySelector('button[type="submit"]');
const render = async () => { await act(async () => root.render(<OnboardingScreen />)); };
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockSave.mockResolvedValue(undefined);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

test('desktop preferences save clicked genres and discovery style without a gesture', async () => {
  await render();
  expect(control('Rock').checked).toBe(true);
  act(() => control('Rock').click());
  expect(saveButton().disabled).toBe(true);
  act(() => control('Jazz').click());
  act(() => control('Surprise me').click());
  expect(saveButton().disabled).toBe(false);
  await act(async () => { saveButton().click(); await new Promise((resolve) => setTimeout(resolve, 5)); });
  expect(mockSave).toHaveBeenCalledWith(['pop', 'jazz'], 'surprise');
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(container.textContent).not.toContain('PULL UP');
});

test('a failed save preserves selections and permits a normal button retry', async () => {
  mockSave.mockRejectedValueOnce(new Error('unavailable'));
  await render();
  act(() => control('Deep underground').click());
  await act(async () => { saveButton().click(); await new Promise((resolve) => setTimeout(resolve, 5)); });
  expect(container.querySelector('[role="alert"]').textContent).toContain('try again');
  expect(control('Deep underground').checked).toBe(true);
  expect(saveButton().disabled).toBe(false);
  expect(mockRouter.back).not.toHaveBeenCalled();
  await act(async () => { saveButton().click(); await new Promise((resolve) => setTimeout(resolve, 5)); });
  expect(mockSave).toHaveBeenCalledTimes(2);
  expect(mockSave).toHaveBeenLastCalledWith(['rock', 'pop'], 'underground');
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test('pending saves disable editing and cannot submit twice', async () => {
  let finish;
  mockSave.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  await render();
  act(() => saveButton().click());
  expect(saveButton().disabled).toBe(true);
  expect([...container.querySelectorAll('fieldset')].every((fieldset) => fieldset.disabled)).toBe(true);
  act(() => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(mockSave).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); await new Promise((resolve) => setTimeout(resolve, 5)); });
});
