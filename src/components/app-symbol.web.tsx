import type { SymbolViewProps } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { symbolPaths } from '@/components/icons/symbol-paths';

export type { SymbolViewProps } from 'expo-symbols';

/** Browser icons use actual SVG outlines, never private-use font characters. */
export function SymbolView({ name, size = 24, tintColor = '#FFFFFF', style, fallback, ...props }: SymbolViewProps) {
  const symbol = typeof name === 'string' ? name : name.ios || '';
  const path = symbolPaths[symbol];
  if (!path && fallback) return <>{fallback}</>;
  return (
    <View
      accessible={Boolean(props.accessibilityLabel)}
      accessibilityLabel={props.accessibilityLabel}
      accessibilityRole={props.accessibilityLabel ? 'image' : undefined}
      aria-hidden={!props.accessibilityLabel}
      style={[styles.frame, { width: size, height: size }, style]}
      testID={props.testID}>
      <Svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
        <Path d={path || symbolPaths.__fallback} fill={tintColor} />
      </Svg>
      {symbol === 'repeat.1' ? (
        <Text aria-hidden style={[styles.repeatOne, { color: tintColor, fontSize: size * 0.3 }]}>1</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', flexShrink: 0, pointerEvents: 'none' },
  repeatOne: { position: 'absolute', fontWeight: '800' },
});
