import { requireNativeModule } from 'expo-modules-core';

import type { RemoteControlHandlers, RemoteControlOptions } from './remote-controls';
import { reportError } from './telemetry';

type AndroidRemoteModule = {
  configureCrimsonRemoteControls?: (active: boolean, canGoNext: boolean, canGoPrevious: boolean, liked: boolean) => void;
  addListener: (event: string, listener: () => void) => { remove: () => void };
};

// The prebuild adapter extends ExpoAudio itself. Its existing foreground service
// remains the only MediaSession and owner of play/pause, seeking and audio focus.
const audio = requireNativeModule<AndroidRemoteModule>('ExpoAudio');
let reportedMissingAdapter = false;
function available() {
  if (typeof audio.configureCrimsonRemoteControls === 'function') return true;
  if (!reportedMissingAdapter) {
    reportedMissingAdapter = true;
    reportError(new Error('This Android binary needs rebuilding with the Crimson media-controls config plugin.'), 'android.remote.native-adapter');
  }
  return false;
}

export function configureRemoteControls({ active, canGoNext, canGoPrevious, liked }: RemoteControlOptions) {
  if (!available()) return;
  audio.configureCrimsonRemoteControls!(active, canGoNext, canGoPrevious, liked);
}

export function subscribeToRemoteControls({ onLike, onNext, onPrevious }: RemoteControlHandlers) {
  if (!available()) return () => {};
  const subscriptions = [
    audio.addListener('crimsonRemoteLike', onLike),
    audio.addListener('crimsonRemoteNext', onNext),
    audio.addListener('crimsonRemotePrevious', onPrevious),
  ];
  return () => subscriptions.forEach((subscription) => subscription.remove());
}
