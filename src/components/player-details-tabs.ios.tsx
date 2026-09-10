import { GlassView } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { PlayerDetailsTab, PlayerDetailsTabsProps } from '@/components/player-details-tabs.types';
import { useAppSettings } from '@/providers/settings-provider';

const tabs: { label: string; value: PlayerDetailsTab }[] = [
  { label: 'UP NEXT', value: 'queue' },
  { label: 'LYRICS', value: 'lyrics' },
  { label: 'RELATED', value: 'related' },
];
const trackPadding = 5;

export default function PlayerDetailsTabs({ onChange, value }: PlayerDetailsTabsProps) {
  const { colors, isDark, performanceMode, reduceMotion } = useAppSettings();
  const [trackWidth, setTrackWidth] = useState(0);
  const selectedIndex = Math.max(0, tabs.findIndex((item) => item.value === value));
  const animatedIndex = useSharedValue(selectedIndex);
  const segmentWidth = Math.max(0, (trackWidth - trackPadding * 2) / tabs.length);

  useEffect(() => {
    animatedIndex.value = reduceMotion
      ? selectedIndex
      : withSpring(selectedIndex, {
        damping: 24,
        mass: 0.78,
        stiffness: 225,
        overshootClamping: true,
      });
  }, [animatedIndex, reduceMotion, selectedIndex]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: animatedIndex.value * segmentWidth }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      accessibilityRole="tablist"
      onLayout={handleLayout}
      style={[
        styles.track,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
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
          {!performanceMode ? (
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

      {tabs.map((item) => {
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
    height: 56,
    marginTop: 14,
    marginHorizontal: 13,
    marginBottom: 8,
    flexDirection: 'row',
    padding: trackPadding,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    borderCurve: 'continuous',
  },
  thumb: {
    position: 'absolute',
    left: trackPadding,
    top: trackPadding,
    bottom: trackPadding,
    overflow: 'hidden',
    borderRadius: 23,
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
