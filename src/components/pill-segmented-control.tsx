import { GlassView } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useAppSettings } from '@/providers/settings-provider';

const trackPadding = 5;

type PillSegmentedControlProps<T extends string> = {
  options: readonly { label: string; value: T }[];
  onChange: (value: T) => void;
  value: T;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

export default function PillSegmentedControl<T extends string>({
  options, onChange, value, style, labelStyle, accessibilityLabel,
}: PillSegmentedControlProps<T>) {
  const { colors, isDark, performanceMode, reduceMotion } = useAppSettings();
  const [trackWidth, setTrackWidth] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((item) => item.value === value));
  const animatedIndex = useSharedValue(selectedIndex);
  const segmentWidth = Math.max(0, (trackWidth - trackPadding * 2) / options.length);

  useEffect(() => {
    animatedIndex.value = reduceMotion || performanceMode
      ? selectedIndex
      : withSpring(selectedIndex, {
        damping: 24,
        mass: 0.78,
        stiffness: 225,
        overshootClamping: true,
      });
  }, [animatedIndex, performanceMode, reduceMotion, selectedIndex]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: animatedIndex.value * segmentWidth }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={handleLayout}
      style={[
        styles.track,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}>
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            {
              backgroundColor: performanceMode ? colors.accent : isDark ? 'rgba(143,89,245,0.68)' : 'rgba(125,63,209,0.62)',
              width: segmentWidth,
            },
            performanceMode && { shadowOpacity: 0 },
            thumbStyle,
          ]}>
          {Platform.OS === 'ios' && !performanceMode ? (
            <GlassView
              colorScheme={isDark ? 'dark' : 'light'}
              glassEffectStyle="regular"
              isInteractive
              tintColor={colors.accent}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </Animated.View>
      ) : null}

      {options.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(item.value)}
            style={styles.tab}>
            <Text
              style={[
                styles.label,
                labelStyle,
                { color: selected ? '#FFFFFF' : colors.secondaryText },
                selected && styles.labelSelected,
              ]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 52,
    flexShrink: 0,
    flexDirection: 'row',
    padding: trackPadding,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    borderCurve: 'continuous',
  },
  thumb: {
    position: 'absolute',
    left: trackPadding,
    top: trackPadding,
    bottom: trackPadding,
    overflow: 'hidden',
    borderRadius: 999,
    borderCurve: 'continuous',
    shadowColor: '#7E46D8',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  tab: {
    zIndex: 1,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontWeight: '800' },
  labelSelected: { color: '#FFFFFF' },
});
