import { BlurTargetView, BlurView } from 'expo-blur';
import { createContext, type ReactNode, useContext, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppSettings } from '@/providers/settings-provider';

type Target = { current: View | null };
const BackdropContext = createContext<Target | undefined>(undefined);

export function FrostedBackdropProvider({ target, children }: { target: Target; children: ReactNode }) {
  return <BackdropContext.Provider value={target}>{children}</BackdropContext.Provider>;
}

/** The target contains only the background. Never capture a blur that targets itself. */
export function FrostedLayer({ background, children, style }: {
  background: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const nativeTarget = useRef<View | null>(null);
  const parentTarget = useContext(BackdropContext);
  const [target, setTarget] = useState<View | null>(null);
  // A new ref object after attachment makes expo-blur resolve the native target
  // even when the blur's child mount precedes the target's ref attachment.
  const targetRef = useMemo(() => ({ current: target }), [target]);
  return (
    <View style={style}>
      {Platform.OS === 'android' ? (
        <BlurTargetView ref={nativeTarget} onLayout={() => setTarget(nativeTarget.current)} style={StyleSheet.absoluteFill}>
          <BackdropContext.Provider value={parentTarget}>{background}</BackdropContext.Provider>
        </BlurTargetView>
      ) : background}
      <BackdropContext.Provider value={targetRef}>{children}</BackdropContext.Provider>
    </View>
  );
}

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  tone?: 'auto' | 'dark';
  accent?: boolean;
  intensity?: number;
  solidColor?: string;
};

/** Decorative backdrop only: controls above it retain their normal touch handling. */
export function FrostedBackdrop({ radius = 24, tone = 'auto', accent = false, intensity = 58, solidColor }: Omit<Props, 'children' | 'style'>) {
  const { colors, isDark, performanceMode } = useAppSettings();
  const target = useContext(BackdropContext);
  const dark = tone === 'dark' || isDark;
  const baseColor = solidColor ?? (accent ? colors.accent : tone === 'dark' ? '#251B36' : colors.elevated);
  // Preserve the original palette: only its alpha changes, with no highlight or edge treatment.
  const translucentColor = baseColor.startsWith('#') && baseColor.length === 7 ? `${baseColor}CC` : baseColor;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}>
      {performanceMode ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: baseColor }]} />
      ) : <>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFill, {
            backdropFilter: `blur(${intensity * 0.2}px)`,
            WebkitBackdropFilter: `blur(${intensity * 0.2}px)`,
          } as ViewStyle]} />
        ) : Platform.OS !== 'android' || target?.current ? (
          <BlurView blurTarget={target} blurMethod="dimezisBlurView" blurReductionFactor={4}
            intensity={intensity} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: translucentColor }]} />
      </>}
    </View>
  );
}

export default function FrostedSurface({ children, style, radius = 24, ...props }: Props) {
  return (
    <View style={[style, { borderRadius: radius, backgroundColor: 'transparent' }]}>
      <FrostedBackdrop radius={radius} {...props} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
