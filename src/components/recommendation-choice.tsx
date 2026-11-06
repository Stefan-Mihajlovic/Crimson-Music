import { useEffect } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { BrandAccent } from '@/constants/brand-accent';
import { SymbolView } from '@/components/app-symbol';
import { PreferencesGlassSurface } from '@/components/preferences-glass';
import type { RecommendationStyle } from '@/services/auth';
import { recommendationDetails, recommendationOrder } from '@/services/recommendation-presentation';

export function RecommendationChoice({ id, label, selected, reduceMotion, onPress }: {
  id: RecommendationStyle; label: string; selected: boolean; reduceMotion: boolean; onPress: () => void;
}) {
  const selection = useSharedValue(selected ? 1 : 0);
  const check = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    selection.set(reduceMotion ? Number(selected) : withTiming(Number(selected), { duration: 240 }));
    check.set(reduceMotion ? Number(selected) : withSpring(Number(selected), { damping: 18, stiffness: 260, mass: 0.7 }));
    return () => { cancelAnimation(selection); cancelAnimation(check); };
  }, [check, reduceMotion, selected, selection]);
  useEffect(() => {
    if (reduceMotion) { cancelAnimation(press); press.set(1); }
    return () => cancelAnimation(press);
  }, [press, reduceMotion]);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: selection.value }));
  const borderStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(selection.value, [0, 1], ['#FFFFFF18', '#D6B6FFAA']) }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: selection.value, transform: [{ scale: 0.65 + check.value * 0.35 }] }));
  const detail = recommendationDetails[id];
  return <Animated.View style={pressStyle}>
    <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityHint={detail.description} accessibilityState={{ checked: selected }}
      onPress={onPress}
      onPressIn={() => press.set(reduceMotion ? 1 : withTiming(0.985, { duration: 130 }))}
      onPressOut={() => press.set(reduceMotion ? 1 : withSpring(1, { damping: 22, stiffness: 300, mass: 0.65 }))}
      style={styles.choice}>
      {/* Keep native glass stable; animate an overlay instead of replacing its
          tint/border instantly or animating an ancestor's opacity. */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <PreferencesGlassSurface radius={24} effect="clear" tintColor="rgba(255,255,255,0.025)" style={StyleSheet.absoluteFill} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.tint, fillStyle]}>
          <LinearGradient colors={[BrandAccent.dark, '#6D35C7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.border, borderStyle]} />
      </View>
      <View pointerEvents="none" style={styles.choiceContent}>
        <View style={styles.badge}><SymbolView name={detail.icon} size={22} tintColor="#F0E4FF" /></View>
        <View style={styles.copy}><Text style={styles.label}>{label}</Text><Text style={styles.description}>{detail.description}</Text></View>
        <View style={styles.checkSlot}>
          <View style={styles.emptyCheck} />
          <Animated.View style={[StyleSheet.absoluteFill, checkStyle]}><SymbolView name="checkmark.circle.fill" size={23} tintColor="#FFFFFF" /></Animated.View>
        </View>
      </View>
    </Pressable>
  </Animated.View>;
}

export function DiscoveryPreview({ images, selected, reduceMotion }: { images: ImageSource[]; selected: RecommendationStyle; reduceMotion: boolean }) {
  const spread = useSharedValue(recommendationOrder.indexOf(selected));
  useEffect(() => {
    spread.set(reduceMotion ? recommendationOrder.indexOf(selected) : withSpring(recommendationOrder.indexOf(selected), { damping: 24, stiffness: 150, mass: 0.8 }));
    return () => cancelAnimation(spread);
  }, [reduceMotion, selected, spread]);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.preview}>
    <Svg width="100%" height={140} viewBox="0 0 320 140" style={StyleSheet.absoluteFill}>
      <Defs><RadialGradient id="discovery-glow"><Stop offset="0" stopColor={BrandAccent.dark} stopOpacity={0.28} /><Stop offset="1" stopColor={BrandAccent.dark} stopOpacity={0} /></RadialGradient></Defs>
      <Ellipse cx={160} cy={70} rx={150} ry={62} fill="url(#discovery-glow)" />
    </Svg>
    {[0, 1, 2, 3].map((index) => <PreviewSleeve key={index} index={index} source={images[index % images.length]} spread={spread} />)}
  </View>;
}

function PreviewSleeve({ index, source, spread }: { index: number; source: ImageSource; spread: ReturnType<typeof useSharedValue<number>> }) {
  const animated = useAnimatedStyle(() => {
    const distance = index - 1.5;
    return { transform: [
      { translateX: distance * (34 + spread.value * 13) },
      { translateY: Math.abs(distance) * (8 + spread.value * 3) },
      { rotate: `${distance * (8 + spread.value * 5)}deg` },
    ] };
  });
  return <Animated.View style={[styles.sleeve, { zIndex: index === 1 ? 4 : index === 2 ? 3 : 1 }, animated]}>
    <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
    <LinearGradient colors={['#FFFFFF16', '#09070D00', '#09070D66']} style={StyleSheet.absoluteFill} />
    <View style={styles.sleeveEdge} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  choice: { borderRadius: 24, overflow: 'hidden', minHeight: 84 },
  choiceContent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16, minHeight: 84 },
  tint: { borderRadius: 24, overflow: 'hidden' }, border: { borderWidth: 1, borderRadius: 24 },
  badge: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 },
  label: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', lineHeight: 21 },
  description: { color: 'rgba(244,235,255,0.72)', fontSize: 12, lineHeight: 16, marginTop: 4 },
  checkSlot: { width: 23, height: 23, alignItems: 'center', justifyContent: 'center' },
  emptyCheck: { width: 21, height: 21, borderRadius: 11, borderWidth: 1, borderColor: '#FFFFFF40' },
  preview: { height: 142, marginBottom: 6 }, sleeve: { position: 'absolute', width: 80, height: 92, left: '50%', marginLeft: -40, top: 10, borderRadius: 15, overflow: 'hidden', backgroundColor: '#28143E' },
  sleeveEdge: { position: 'absolute', inset: 0, borderWidth: 1, borderColor: '#FFFFFF30', borderRadius: 15 },
});
