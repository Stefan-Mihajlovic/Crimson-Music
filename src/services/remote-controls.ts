export type RemoteControlHandlers = {
  onLike: () => void;
  onNext: () => void;
  onPrevious: () => void;
};

export type RemoteControlOptions = {
  active: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
  duration: number;
  elapsedTime: number;
  liked: boolean;
  playing: boolean;
};

export function configureRemoteControls(_options: RemoteControlOptions) {}

export function subscribeToRemoteControls(_handlers: RemoteControlHandlers) {
  return () => {};
}
