import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Alert } from '@/services/alert';

let activeVoiceSession: string | null = null;

export function useVoiceSearch({
  onBegin,
  onTranscript,
}: {
  onBegin?: () => void;
  onTranscript: (transcript: string) => void;
}) {
  const sessionId = useId();
  const [listening, setListening] = useState(false);
  const mounted = useRef(true);
  const requesting = useRef(false);

  useSpeechRecognitionEvent('start', () => {
    if (activeVoiceSession === sessionId) setListening(true);
  });
  useSpeechRecognitionEvent('result', (event) => {
    if (activeVoiceSession !== sessionId) return;
    const transcript = event.results[0]?.transcript;
    if (transcript) onTranscript(transcript);
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (activeVoiceSession !== sessionId) return;
    setListening(false);
    activeVoiceSession = null;
    if (event.error !== 'aborted' && event.error !== 'no-speech') {
      Alert.alert('Voice search is unavailable', event.message || 'Please try again.');
    }
  });
  useSpeechRecognitionEvent('end', () => {
    if (activeVoiceSession !== sessionId) return;
    setListening(false);
    activeVoiceSession = null;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (activeVoiceSession !== sessionId) return;
      activeVoiceSession = null;
      ExpoSpeechRecognitionModule.abort();
    };
  }, [sessionId]);

  const stop = useCallback(() => {
    if (activeVoiceSession !== sessionId) return;
    ExpoSpeechRecognitionModule.stop();
  }, [sessionId]);

  const toggle = useCallback(async () => {
    if (listening) {
      stop();
      return;
    }
    if (requesting.current) return;
    requesting.current = true;
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        Alert.alert('Voice search is unavailable', Platform.select({
          ios: 'Enable Siri & Dictation in Settings and try again.',
          android: 'Enable a speech recognition service, such as the Google app, in your device settings. You can also type your search.',
          default: 'This browser does not support speech recognition. Try a supported browser or type your search.',
        }));
        return;
      }
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!mounted.current) return;
      if (!permission.granted) {
        Alert.alert('Voice search needs permission', Platform.OS === 'web'
          ? 'Allow microphone access for this site in your browser settings.'
          : 'Allow microphone and speech recognition access in Settings.');
        return;
      }
      if (activeVoiceSession && activeVoiceSession !== sessionId) ExpoSpeechRecognitionModule.abort();
      activeVoiceSession = sessionId;
      setListening(true);
      onBegin?.();
      ExpoSpeechRecognitionModule.start({
        addsPunctuation: false,
        continuous: false,
        interimResults: true,
        iosTaskHint: 'search',
      });
    } catch {
      if (activeVoiceSession === sessionId) activeVoiceSession = null;
      if (!mounted.current) return;
      setListening(false);
      Alert.alert('Voice search is unavailable', 'Please try again.');
    } finally {
      requesting.current = false;
    }
  }, [listening, onBegin, sessionId, stop]);

  return { listening, stop, toggle };
}
