import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

export default function AuthBackdrop({ children }: PropsWithChildren) {
  return (
    <View style={styles.root}>
      <Image
        source={require('@/assets/images/auth/auth-background.webp')}
        contentFit="cover"
        contentPosition="top"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.dim} />
      <LinearGradient
        colors={['rgba(13,10,16,0.64)', 'rgba(13,10,16,0.10)', '#0D0A10']}
        locations={[0, 0.46, 0.88]}
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
    backgroundColor: 'rgba(13,10,16,0.42)',
  },
});
