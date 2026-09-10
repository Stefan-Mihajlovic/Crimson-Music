import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useAppSettings } from '@/providers/settings-provider';

export default function ScreenAccentGradient() {
  const { isDark } = useAppSettings();
  return (
    <View pointerEvents="none" style={styles.container}>
      <LinearGradient
        colors={isDark ? [
          'rgba(75, 27, 132, 0.62)',
          'rgba(49, 22, 84, 0.3)',
          'rgba(28, 17, 45, 0.1)',
          'rgba(14, 13, 19, 0)',
          'rgba(14, 13, 19, 0)',
        ] : [
          'rgba(210, 185, 246, 0.62)',
          'rgba(226, 209, 249, 0.34)',
          'rgba(241, 232, 251, 0.14)',
          'rgba(255, 255, 255, 0)',
          'rgba(255, 255, 255, 0)',
        ]}
        locations={[0, 0.34, 0.6, 0.8, 1]}
        style={styles.verticalAccent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  verticalAccent: { position: 'absolute', top: 0, right: 0, left: 0, height: 600 },
});
