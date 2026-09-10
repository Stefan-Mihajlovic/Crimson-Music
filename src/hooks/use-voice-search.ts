import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useId, useState } from 'react';
import { Alert } from 'react-native';

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

  useEffect(() => () => {
    if (activeVoiceSession !== sessionId) return;
    activeVoiceSession = null;
    ExpoSpeechRecognitionModule.abort();
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
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      Alert.alert('Voice search is unavailable', 'Enable Siri & Dictation in Settings and try again.');
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Voice search needs permission', 'Allow microphone and speech recognition access in Settings.');
      return;
    }
    activeVoiceSession = sessionId;
    setListening(true);
    onBegin?.();
    try {
      ExpoSpeechRecognitionModule.start({
        addsPunctuation: false,
        continuous: false,
        interimResults: true,
        iosTaskHint: 'search',
      });
    } catch {
      activeVoiceSession = null;
      setListening(false);
      Alert.alert('Voice search is unavailable', 'Please try again.');
    }
  }, [listening, onBegin, sessionId, stop]);

  return { listening, stop, toggle };
}
