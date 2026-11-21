import { Platform } from 'react-native';
import { AndroidHaptics, performAndroidHapticsAsync, selectionAsync } from 'expo-haptics';
/** A single subtle tick for a committed action, never every animation frame. */
export function selectionHaptic() {
  if (Platform.OS === 'android') { void performAndroidHapticsAsync(AndroidHaptics.Segment_Tick).catch(() => undefined); return; }
  if (Platform.OS !== 'web') void selectionAsync().catch(() => undefined);
}
