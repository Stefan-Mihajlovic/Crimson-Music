/* eslint-disable react-hooks/immutability */

import { PropsWithChildren } from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useAppSettings } from '@/providers/settings-provider';

type BouncyPressableProps = Omit<PressableProps, 'style'> & {
  contentStyle?: StyleProp<ViewStyle>;
  pressedScale?: number;
  style?: StyleProp<ViewStyle>;
};

export default function BouncyPressable({
  children,
  contentStyle,
  disabled,
  onPressIn,
  onPressOut,
  pressedScale = 0.86,
  style,
  ...props
}: PropsWithChildren<BouncyPressableProps>) {
  const { performanceMode, reduceMotion } = useAppSettings();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.container, style, disabled && styles.disabled, animatedStyle]}>
      <Pressable
        {...props}
        disabled={disabled}
        onPressIn={(event) => {
          scale.value = reduceMotion || performanceMode ? 1 : withTiming(pressedScale, { duration: 90 });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = reduceMotion || performanceMode ? 1 : withSpring(1, { damping: 7, mass: 0.42, stiffness: 330 });
          onPressOut?.(event);
        }}
        style={[styles.pressable, contentStyle]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  pressable: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.48 },
});
