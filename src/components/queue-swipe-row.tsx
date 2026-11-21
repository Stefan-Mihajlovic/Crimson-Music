import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SymbolView } from '@/components/app-symbol';
import { useAppSettings } from '@/providers/settings-provider';
import { selectionHaptic } from '@/services/haptics';

export default function QueueSwipeRow({ children, enabled, onRemove }: PropsWithChildren<{ enabled: boolean; onRemove: () => void }>) {
  const { colors, reduceMotion, performanceMode } = useAppSettings();
  const x = useSharedValue(0);
  const commit = () => { selectionHaptic(); onRemove(); };
  const gesture = Gesture.Pan().enabled(enabled).activeOffsetX([-14, 14]).failOffsetY([-9, 9])
    .onUpdate((event) => { x.value = Math.max(-100, Math.min(0, event.translationX)); })
    .onEnd((event) => { if (event.translationX < -72) scheduleOnRN(commit); })
    .onFinalize(() => { x.value = withTiming(0, { duration: reduceMotion || performanceMode ? 0 : 180 }); });
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <View style={styles.clip}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.remove}><SymbolView name="trash" size={22} tintColor="#FFFFFF" /></View>
    <GestureDetector gesture={gesture}><Animated.View style={[styles.content, { backgroundColor: colors.elevated }, style]}>{children}</Animated.View></GestureDetector>
  </View>;
}
const styles = StyleSheet.create({ clip: { flex: 1, overflow: 'hidden' }, content: { flex: 1 }, remove: { position: 'absolute', inset: 0, backgroundColor: '#B33250', alignItems: 'flex-end', justifyContent: 'center', paddingRight: 28 } });
