import { NativeModules, Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { createAudioPlayer } from 'expo-audio';
import { createOnboardingFeedback } from '../src/services/onboarding-feedback';

jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn() }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn().mockResolvedValue(), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' } }));
const native = { prepareOnboardingFeedback: jest.fn(), startOnboardingPull: jest.fn(), updateOnboardingPull: jest.fn(), stopOnboardingPull: jest.fn(), completeOnboardingPull: jest.fn() };
let feedback;
beforeEach(() => {
  Platform.OS = 'ios';
  NativeModules.CrimsonRemoteControls = native;
  Asset.fromModule.mockReturnValue({ downloadAsync: jest.fn().mockResolvedValue({ localUri: 'file:///chime.wav' }) });
});
afterEach(() => { feedback?.dispose(); feedback = undefined; delete NativeModules.CrimsonRemoteControls; Platform.OS = 'ios'; jest.useRealTimers(); });

test('resistance tracks normalized progress in both directions and stops on cancel', async () => {
  feedback = createOnboardingFeedback();
  await feedback.prepare();
  await feedback.prepare();
  expect(native.prepareOnboardingFeedback).toHaveBeenCalledTimes(1);
  feedback.start();
  for (const progress of [0.1, 0.5, 0.9, 0.2]) feedback.update(progress);
  expect(native.updateOnboardingPull.mock.calls.map(([value]) => value)).toEqual([0.1 / 0.76, 0.5 / 0.76, 1, 0.2 / 0.76]);
  feedback.stop();
  feedback.update(0.9);
  expect(native.updateOnboardingPull).toHaveBeenCalledTimes(4);
  expect(native.completeOnboardingPull).not.toHaveBeenCalled();
});

test('completion plays once and stale events after disposal are ignored', () => {
  feedback = createOnboardingFeedback();
  feedback.start(); feedback.complete(); feedback.complete();
  expect(native.completeOnboardingPull).toHaveBeenCalledTimes(1);
  feedback.dispose(); feedback.start(); feedback.update(1); feedback.complete();
  expect(native.startOnboardingPull).toHaveBeenCalledTimes(1);
  expect(native.updateOnboardingPull).not.toHaveBeenCalled();
});

test('an asset loading after unmount cannot prepare native feedback', async () => {
  let resolve;
  Asset.fromModule.mockReturnValue({ downloadAsync: () => new Promise(done => { resolve = done; }) });
  feedback = createOnboardingFeedback();
  const preparing = feedback.prepare();
  feedback.dispose(); resolve({ localUri: 'file:///chime.wav' });
  await preparing;
  expect(native.prepareOnboardingFeedback).not.toHaveBeenCalled();
});

test('fallback chime finishes its tail across navigation, then releases audio', async () => {
  jest.useFakeTimers();
  Platform.OS = 'android';
  const audio = { play: jest.fn(), remove: jest.fn() };
  createAudioPlayer.mockReturnValue(audio);
  feedback = createOnboardingFeedback();
  await feedback.prepare();
  feedback.complete(); feedback.dispose();
  expect(audio.play).toHaveBeenCalledTimes(1);
  expect(audio.remove).not.toHaveBeenCalled();
  jest.advanceTimersByTime(900);
  expect(audio.remove).toHaveBeenCalledTimes(1);
});
