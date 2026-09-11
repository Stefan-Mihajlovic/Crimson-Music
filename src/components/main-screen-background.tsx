import { FrostedLayer } from '@/components/frosted-surface';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useAppSettings } from '@/providers/settings-provider';

/**
 * Paint behind the scroll view without inserting a decorative first sibling.
 * UIKit finds the scroll view through the first native descendant chain.
 */
export default function MainScreenBackground({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  const { colors, isDark } = useAppSettings();
  const { height } = useWindowDimensions();
  const extent = Math.min(1, 600 / height);
  const background = (
    <LinearGradient
      colors={isDark ? [
        'rgba(75,27,132,0.62)', 'rgba(49,22,84,0.3)', 'rgba(28,17,45,0.1)',
        'rgba(14,13,19,0)', 'rgba(14,13,19,0)',
      ] : [
        'rgba(210,185,246,0.62)', 'rgba(226,209,249,0.34)', 'rgba(241,232,251,0.14)',
        'rgba(255,255,255,0)', 'rgba(255,255,255,0)',
      ]}
      locations={[0, 0.34 * extent, 0.6 * extent, 0.8 * extent, extent]}
      style={[Platform.OS === 'ios' ? styles.screen : StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
      {Platform.OS === 'ios' ? <>{children}{overlay}</> : null}
    </LinearGradient>
  );
  return Platform.OS === 'ios' ? background : <FrostedLayer style={styles.screen} background={background}>
    <FrostedLayer style={styles.screen} background={<View style={styles.screen}>{background}{children}</View>}>{overlay}</FrostedLayer>
  </FrostedLayer>;
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
