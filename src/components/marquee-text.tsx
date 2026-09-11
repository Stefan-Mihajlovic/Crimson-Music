import { useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import MarqueeMask from '@/components/marquee-mask';
import { useAppSettings } from '@/providers/settings-provider';

const repeatGap = 32;
const pointsPerSecond = 20;
const startPause = 1800;

/** A single line measured at its natural width, with motion confined to its viewport. */
export default function MarqueeText({ text, textStyle, active = true }: {
  text: string;
  textStyle: StyleProp<TextStyle>;
  active?: boolean;
}) {
  const { reduceMotion } = useAppSettings();
  const { fontScale } = useWindowDimensions();
  const label = text.replace(/\s+/g, ' ').trim();
  // Measure in a separate, generously sized line. A Text inside a horizontal
  // ScrollView can still inherit the parent's width and report its truncated size.
  const fontSize = StyleSheet.flatten(textStyle)?.fontSize || 24;
  const measurementWidth = Math.max(1024, label.length * fontSize * fontScale * 2);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [viewportWidth, setViewportWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const offset = useSharedValue(0);
  const overflows = viewportWidth > 0 && textWidth > viewportWidth + 1;
  const motionAllowed = !reduceMotion;
  const copyWidth = textWidth || viewportWidth;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    cancelAnimation(offset);
    offset.set(0);
    if (active && appActive && motionAllowed && overflows) {
      const distance = textWidth + repeatGap;
      const rampDistance = Math.min(10, distance / 4);
      const rampDuration = rampDistance * 2 / pointsPerSecond * 1000;
      // The second copy reaches the first copy's origin before each reset,
      // so the loop stays seamless. Match the ramp and cruise velocities,
      // then come to rest before pausing at the start of every new lap.
      offset.set(withRepeat(withSequence(
        // Reset to the identical first copy before the delay. Otherwise the
        // delay can retain the previous lap's final offset as its start value.
        withTiming(0, { duration: 0 }),
        withDelay(startPause, withTiming(-rampDistance, {
          duration: rampDuration,
          easing: Easing.in(Easing.quad),
        })),
        withTiming(-(distance - rampDistance), {
          duration: (distance - rampDistance * 2) / pointsPerSecond * 1000,
          easing: Easing.linear,
        }),
        withTiming(-distance, {
          duration: rampDuration,
          easing: Easing.out(Easing.quad),
        }),
      ), -1, false));
    }
    return () => cancelAnimation(offset);
  }, [active, appActive, motionAllowed, offset, overflows, text, textWidth, viewportWidth]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));

  const title = (
    <Text numberOfLines={1} ellipsizeMode="clip" style={[textStyle, styles.copy, { width: copyWidth }]}>{label}</Text>
  );

  return (
    <View
      onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
      style={styles.viewport}>
      <Text
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        numberOfLines={1}
        ellipsizeMode="clip"
        onTextLayout={(event) => {
          const line = event.nativeEvent.lines[0];
          if (line) setTextWidth(Math.ceil(line.width) + 1);
        }}
        style={[textStyle, styles.measurement, { width: measurementWidth }]}>{label}</Text>
      {motionAllowed ? (
        <MarqueeMask offset={offset} textWidth={textWidth} viewportWidth={viewportWidth} repeatGap={repeatGap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.track, { width: overflows ? copyWidth * 2 + repeatGap : copyWidth }, animatedStyle]}>
            {title}
            {overflows ? (
              <Text
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                numberOfLines={1}
                ellipsizeMode="clip"
                style={[textStyle, styles.copy, styles.repeat, { width: copyWidth }]}>{label}</Text>
            ) : null}
          </Animated.View>
        </MarqueeMask>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
          {title}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flexGrow: 0, width: '100%', overflow: 'hidden' },
  measurement: { position: 'absolute', top: 0, left: 0, opacity: 0 },
  track: { flexDirection: 'row', alignItems: 'center' },
  copy: { flexShrink: 0 },
  repeat: { marginLeft: repeatGap },
});
