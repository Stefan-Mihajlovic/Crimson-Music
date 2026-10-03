import { useSyncExternalStore } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { FoldingFeature } from '@/services/adaptive-layout';

let feature: FoldingFeature | null = null;
let subscription: { remove(): void } | undefined;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  const native = Platform.OS === 'android' ? NativeModules.CrimsonFolding : null;
  if (!subscription && native) subscription = new NativeEventEmitter(native).addListener('crimsonFoldingChanged', (value) => {
    feature = value.orientation ? value as FoldingFeature : null;
    listeners.forEach((notify) => notify());
  });
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { subscription?.remove(); subscription = undefined; feature = null; }
  };
}
const snapshot = () => feature;
const serverSnapshot = () => null;
/** One activity-scoped subscription shared by the player and its animation geometry. */
export function useFoldingFeature() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
