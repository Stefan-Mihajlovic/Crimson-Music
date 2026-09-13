import { LinearGradient } from 'expo-linear-gradient';
import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import WelcomeArtworkGrid from '@/components/welcome-artwork-grid';

export default function AuthBackdrop({ children }: PropsWithChildren) {
  return (
    <View style={styles.root}>
      <WelcomeArtworkGrid />
      <View style={styles.dim} />
      <LinearGradient
        colors={['rgba(13,10,16,0.58)', 'rgba(13,10,16,0.04)', '#0D0A10']}
        locations={[0, 0.4, 0.88]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', 'rgba(13,10,16,0.88)']}
        locations={[0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0D0A10',
  },
  dim: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(16,8,29,0.34)',
  },
});
