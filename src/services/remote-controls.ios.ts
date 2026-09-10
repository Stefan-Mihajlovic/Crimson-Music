import { NativeEventEmitter, NativeModules } from 'react-native';

import type { RemoteControlHandlers, RemoteControlOptions } from '@/services/remote-controls';

type CrimsonRemoteControlsModule = {
  addListener: (eventName: string) => void;
  configure: (
    active: boolean,
    liked: boolean,
    canGoNext: boolean,
    canGoPrevious: boolean,
    playing: boolean,
    elapsedTime: number,
    duration: number,
  ) => void;
  removeListeners: (count: number) => void;
};

const remoteControls = NativeModules.CrimsonRemoteControls as CrimsonRemoteControlsModule | undefined;
const emitter = remoteControls ? new NativeEventEmitter(remoteControls) : null;

export function configureRemoteControls({
  active,
  canGoNext,
  canGoPrevious,
  duration,
  elapsedTime,
  liked,
  playing,
}: RemoteControlOptions) {
  remoteControls?.configure(
    active,
    liked,
    canGoNext,
    canGoPrevious,
    playing,
    elapsedTime,
    duration,
  );
}

export function subscribeToRemoteControls({ onLike, onNext, onPrevious }: RemoteControlHandlers) {
  if (!emitter) return () => {};
  const subscriptions = [
    emitter.addListener('remoteLike', onLike),
    emitter.addListener('remoteNext', onNext),
    emitter.addListener('remotePrevious', onPrevious),
  ];
  return () => subscriptions.forEach((subscription) => subscription.remove());
}
