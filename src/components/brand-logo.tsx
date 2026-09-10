import { Image } from 'expo-image';
import { StyleProp, ImageStyle } from 'react-native';

export default function BrandLogo({ style }: { style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      accessibilityLabel="Crimson Music"
      source={require('@/assets/images/auth/crimson-logo.webp')}
      contentFit="contain"
      style={style}
    />
  );
}
