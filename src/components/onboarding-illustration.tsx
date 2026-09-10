import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { useAppSettings } from '@/providers/settings-provider';

export type OnboardingScene = 'discover' | 'identity' | 'library';

type OnboardingIllustrationProps = { scene: OnboardingScene };

export default function OnboardingIllustration({ scene }: OnboardingIllustrationProps) {
  const { performanceMode, reduceMotion } = useAppSettings();
  const [motion] = useState(() => new Animated.Value(0));
  const [float] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (performanceMode || reduceMotion) {
      motion.setValue(0);
      float.setValue(0);
      pulse.setValue(0);
      return;
    }
    const animations = [
      Animated.loop(
        Animated.timing(motion, {
          toValue: 1,
          duration: 9000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(float, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 900,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    ];

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [float, motion, performanceMode, pulse, reduceMotion]);

  const animation = { motion, float, pulse };

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.frame}>
      <Svg height="100%" viewBox="0 0 340 310" width="100%">
        <Defs>
          <LinearGradient id="crimson" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor="#F04BA8" />
            <Stop offset="0.52" stopColor="#9A58FF" />
            <Stop offset="1" stopColor="#5E7BFF" />
          </LinearGradient>
          <LinearGradient id="glass" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.24" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.05" />
          </LinearGradient>
        </Defs>
      </Svg>
      {scene === 'identity' && <IdentityScene {...animation} />}
      {scene === 'discover' && <DiscoverScene {...animation} />}
      {scene === 'library' && <LibraryScene {...animation} />}
    </View>
  );
}

type SceneAnimation = {
  float: Animated.Value;
  motion: Animated.Value;
  pulse: Animated.Value;
};

function IdentityScene({ float, motion, pulse }: SceneAnimation) {
  const rotation = motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [-7, 7] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });

  return (
    <>
      <Animated.View style={[styles.fullLayer, { transform: [{ rotate: rotation }] }]}>
        <Svg height="100%" viewBox="0 0 340 310" width="100%">
          <Circle cx="170" cy="155" fill="none" r="111" stroke="#B98AFF" strokeDasharray="5 14" strokeOpacity="0.48" strokeWidth="2" />
          <Circle cx="170" cy="44" fill="#F46FAF" r="8" />
          <Circle cx="281" cy="155" fill="#6F8DFF" r="7" />
          <Circle cx="170" cy="266" fill="#B776FF" r="9" />
          <Circle cx="59" cy="155" fill="#FFB44A" r="6" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.fullLayer, { transform: [{ translateY: floatY }] }]}>
        <Svg height="100%" viewBox="0 0 340 310" width="100%">
          <Path d="M30 213c30-30 53-30 83 0s53 30 83 0 53-30 83 0 31 19 37 13" fill="none" stroke="#B274FF" strokeLinecap="round" strokeOpacity="0.34" strokeWidth="5" />
          <Path d="M38 232c24-18 43-18 67 0s43 18 67 0 43-18 67 0 43 18 65 1" fill="none" stroke="#EF55A5" strokeLinecap="round" strokeOpacity="0.2" strokeWidth="3" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.centerDisc, { transform: [{ scale }] }]}>
        <Svg height="160" viewBox="0 0 160 160" width="160">
          <Defs>
            <LinearGradient id="disc" x1="0" x2="1" y1="0" y2="1">
              <Stop offset="0" stopColor="#F04BA8" />
              <Stop offset="0.55" stopColor="#9A58FF" />
              <Stop offset="1" stopColor="#506EFF" />
            </LinearGradient>
          </Defs>
          <Circle cx="80" cy="80" fill="#0E0B14" opacity="0.65" r="72" stroke="url(#disc)" strokeWidth="4" />
          <Circle cx="80" cy="80" fill="none" opacity="0.28" r="51" stroke="#FFFFFF" strokeWidth="2" />
          <Circle cx="80" cy="80" fill="#FFFFFF" opacity="0.16" r="18" />
          <Path d="M90 42v66c0 13-11 24-25 24-11 0-20-7-20-17 0-11 10-19 22-19 5 0 9 1 12 3V53l35-8v17l-24 6Z" fill="white" />
        </Svg>
      </Animated.View>
    </>
  );
}

function DiscoverScene({ float, motion, pulse }: SceneAnimation) {
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [-9, 9] });
  const inverseY = float.interpolate({ inputRange: [0, 1], outputRange: [8, -8] });
  const scanX = motion.interpolate({ inputRange: [0, 1], outputRange: [-90, 210] });
  const sparkleScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.18] });

  return (
    <>
      <Svg height="100%" style={styles.fullLayer} viewBox="0 0 340 310" width="100%">
        <Circle cx="170" cy="151" fill="#0E0B15" opacity="0.76" r="95" stroke="#B879FF" strokeOpacity="0.62" strokeWidth="3" />
        <Circle cx="170" cy="151" fill="none" r="72" stroke="#FFFFFF" strokeDasharray="2 10" strokeOpacity="0.28" strokeWidth="2" />
        <Circle cx="170" cy="151" fill="url(#glass)" r="48" stroke="#FFFFFF" strokeOpacity="0.34" />
        <Path d="M170 111v80M130 151h80" stroke="#C58DFF" strokeLinecap="round" strokeOpacity="0.68" strokeWidth="4" />
        <Circle cx="170" cy="151" fill="#120D1A" r="15" stroke="#F36BAB" strokeWidth="4" />
      </Svg>
      <Animated.View style={[styles.fullLayer, { transform: [{ translateX: scanX }] }]}>
        <Svg height="100%" viewBox="0 0 340 310" width="100%">
          <Rect fill="#FFFFFF" height="130" opacity="0.08" rx="8" width="18" x="95" y="86" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.trackCardLeft, { transform: [{ translateY: floatY }, { rotate: '-8deg' }] }]}>
        <TrackCard accent="#EF5BA8" bars={[34, 22, 42, 27]} />
      </Animated.View>
      <Animated.View style={[styles.trackCardRight, { transform: [{ translateY: inverseY }, { rotate: '9deg' }] }]}>
        <TrackCard accent="#6E82FF" bars={[19, 41, 27, 36]} />
      </Animated.View>
      <Animated.View style={[styles.sparkle, { transform: [{ scale: sparkleScale }] }]}>
        <Svg height="52" viewBox="0 0 52 52" width="52">
          <Path d="M26 2c2 15 9 22 24 24-15 2-22 9-24 24C24 35 17 28 2 26 17 24 24 17 26 2Z" fill="#FFD36F" />
        </Svg>
      </Animated.View>
    </>
  );
}

function TrackCard({ accent, bars }: { accent: string; bars: number[] }) {
  return (
    <Svg height="112" viewBox="0 0 124 112" width="124">
      <Rect fill="#211829" height="108" rx="24" stroke="#FFFFFF" strokeOpacity="0.26" width="120" x="2" y="2" />
      <Rect fill={accent} height="55" opacity="0.78" rx="17" width="104" x="10" y="10" />
      <Circle cx="34" cy="37" fill="#FFFFFF" opacity="0.88" r="13" />
      <Path d="M40 26v19c0 5-4 9-9 9-4 0-7-3-7-6 0-4 4-7 8-7 2 0 3 0 4 1V29l12-3v6l-8 2Z" fill={accent} />
      {bars.map((height, index) => (
        <Rect key={height + index} fill="#FFFFFF" height={height / 3} opacity={0.8} rx="2" width="4" x={68 + index * 9} y={48 - height / 3} />
      ))}
      <Rect fill="#FFFFFF" height="5" opacity="0.72" rx="2.5" width="70" x="16" y="79" />
      <Rect fill="#FFFFFF" height="4" opacity="0.26" rx="2" width="48" x="16" y="91" />
    </Svg>
  );
}

function LibraryScene({ float, motion, pulse }: SceneAnimation) {
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [-7, 7] });
  const rotation = motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const heartScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] });

  return (
    <>
      <Svg height="100%" style={styles.fullLayer} viewBox="0 0 340 310" width="100%">
        <G transform="translate(54 40) rotate(-7 116 115)">
          <Rect fill="#15101D" height="220" rx="34" stroke="#F05BAA" strokeOpacity="0.44" strokeWidth="2" width="232" />
        </G>
        <G transform="translate(54 36) rotate(6 116 115)">
          <Rect fill="#181321" height="220" rx="34" stroke="#7187FF" strokeOpacity="0.5" strokeWidth="2" width="232" />
        </G>
        <Rect fill="url(#glass)" height="224" rx="36" stroke="#FFFFFF" strokeOpacity="0.26" width="238" x="51" y="39" />
        <Rect fill="#A061F7" height="88" opacity="0.34" rx="26" width="202" x="69" y="57" />
        <Path d="M84 173h172M84 198h132M84 223h150" stroke="#FFFFFF" strokeLinecap="round" strokeOpacity="0.35" strokeWidth="8" />
        <Circle cx="95" cy="101" fill="#FFFFFF" opacity="0.86" r="24" />
        <Path d="M106 83v31c0 7-6 13-14 13-6 0-11-4-11-9 0-6 6-10 12-10 3 0 5 1 6 2V88l18-4v9l-11 3Z" fill="#9958F1" />
      </Svg>
      <Animated.View style={[styles.heart, { transform: [{ translateY: floatY }, { scale: heartScale }] }]}>
        <Svg height="74" viewBox="0 0 74 74" width="74">
          <Circle cx="37" cy="37" fill="#29182F" r="35" stroke="#FFFFFF" strokeOpacity="0.28" />
          <Path d="M37 55S18 44 18 30c0-8 10-13 19-4 9-9 19-4 19 4 0 14-19 25-19 25Z" fill="#F05AA8" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.themeOrb, { transform: [{ rotate: rotation }] }]}>
        <Svg height="76" viewBox="0 0 76 76" width="76">
          <Circle cx="38" cy="38" fill="#171220" r="36" stroke="#FFFFFF" strokeOpacity="0.24" />
          <Circle cx="38" cy="38" fill="#FFD46E" r="13" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((degrees) => (
            <Rect key={degrees} fill="#FFD46E" height="12" rx="2" transform={`rotate(${degrees} 38 38)`} width="4" x="36" y="10" />
          ))}
        </Svg>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 250,
    aspectRatio: 1.1,
    alignSelf: 'center',
    overflow: 'visible',
  },
  fullLayer: { position: 'absolute', inset: 0 },
  centerDisc: { position: 'absolute', left: '50%', top: '50%', marginLeft: -80, marginTop: -80 },
  trackCardLeft: { position: 'absolute', left: 18, top: 98 },
  trackCardRight: { position: 'absolute', right: 16, top: 98 },
  sparkle: { position: 'absolute', right: 40, top: 28 },
  heart: { position: 'absolute', right: 22, top: 35 },
  themeOrb: { position: 'absolute', left: 22, bottom: 24 },
});
