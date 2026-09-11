import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SymbolView } from '../../src/components/app-symbol';
import { useVoiceSearch } from '../../src/hooks/use-voice-search';
import { Alert } from '../../src/services/alert';
import { ExpoSpeechRecognitionModule as speech } from 'expo-speech-recognition';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicon');
jest.mock('../../src/services/alert', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('expo-speech-recognition', () => ({
  useSpeechRecognitionEvent: jest.fn(),
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: jest.fn(() => true), requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    start: jest.fn(), stop: jest.fn(), abort: jest.fn(),
  },
}));
let root;
let voice;
const onTranscript = jest.fn();
function SearchHarness() { voice = useVoiceSearch({ onTranscript }); return null; }
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(() => { if (root) act(() => root.unmount()); });

test('Android shows bundled player and navigation glyphs for shared SF names', () => {
  expect(Platform.OS).toBe('android');
  act(() => { root = create(<><SymbolView name="play.fill" tintColor="#ffffff" size={28} /><SymbolView name="heart" /><SymbolView name={{ ios: 'house', android: 'home' }} /></>); });
  const icons = root.root.findAllByType(Ionicons);
  expect(icons.map((icon) => icon.props.name)).toEqual(['play', 'heart-outline', 'home-outline']);
  expect(icons[0].props).toMatchObject({ size: 28, color: '#ffffff' });
});

test('Android without a recognizer gets relevant instructions instead of Siri settings', async () => {
  speech.isRecognitionAvailable.mockReturnValueOnce(false);
  act(() => { root = create(<SearchHarness />); });
  await act(async () => voice.toggle());
  expect(Alert.alert).toHaveBeenCalledWith('Voice search is unavailable', expect.stringContaining('Google app'));
  expect(speech.start).not.toHaveBeenCalled();
});

test('permission errors are handled and the user can retry', async () => {
  speech.requestPermissionsAsync.mockRejectedValueOnce(new Error('permission service unavailable'));
  act(() => { root = create(<SearchHarness />); });
  await act(async () => voice.toggle());
  expect(Alert.alert).toHaveBeenCalled();
  await act(async () => voice.toggle());
  expect(speech.start).toHaveBeenCalledTimes(1);
});

test('leaving search while permission is pending never starts a microphone session', async () => {
  let finish;
  speech.requestPermissionsAsync.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  act(() => { root = create(<SearchHarness />); });
  let pending;
  act(() => { pending = voice.toggle(); });
  act(() => root.unmount());
  root = null;
  await act(async () => { finish({ granted: true }); await pending; });
  expect(speech.start).not.toHaveBeenCalled();
});
