import { useCallback, useEffect } from 'react';
import { cancelAnimation, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** Height, glass clips and background move together on the UI thread. */
export function useVaultMotion(desktop: boolean, copyBottom: number, motionOff: boolean, onClosed: () => void) {
  const expansion = useSharedValue(0);
  const opener = useSharedValue(0);
  const moods = useSharedValue(280);
  const cancel = useCallback(() => { cancelAnimation(expansion); cancelAnimation(opener); cancelAnimation(moods); }, [expansion, opener, moods]);
  useEffect(() => cancel, [cancel]);
  const transition = useCallback((open: boolean) => {
    cancel();
    if (motionOff) {
      expansion.set(open ? 1 : 0); opener.set(open ? 80 : 0); moods.set(open ? 0 : 280);
      if (!open) onClosed();
      return;
    }
    const spring = { stiffness: 260, damping: 21, mass: 0.9 };
    expansion.set(withDelay(140, withSpring(open ? 1 : 0, spring, (finished) => {
      if (finished && !open) scheduleOnRN(onClosed);
    })));
    opener.set(open ? withTiming(80, { duration: 140 }) : withDelay(140, withSpring(0, spring)));
    moods.set(open ? withDelay(140, withSpring(0, spring)) : withTiming(280, { duration: 140 }));
  }, [cancel, expansion, moods, opener, motionOff, onClosed]);
  const frameStyle = useAnimatedStyle(() => ({
    height: interpolate(expansion.value, [0, 1], desktop ? [190, 286] : [Math.max(140, copyBottom + 90), Math.max(348, copyBottom + 292)]),
    borderColor: interpolateColor(expansion.value, [0, 1], ['rgba(182,140,255,0.42)', 'rgba(206,178,255,0.82)']),
    shadowOpacity: interpolate(expansion.value, [0, 1], [0.34, 0.58]),
  }));
  const backgroundStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + expansion.value * 0.08 }] }));
  const openerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: opener.value }] }));
  const moodsStyle = useAnimatedStyle(() => ({ transform: [{ translateY: moods.value }] }));
  return { transition, frameStyle, backgroundStyle, openerStyle, moodsStyle };
}
