import { type StyleProp, type ViewStyle, View } from 'react-native';
import Svg, { ClipPath, Defs, Image, LinearGradient, Rect, Stop, Text } from 'react-native-svg';

/** Shared wordmark uses the same Soundfold icon as the installed application. */
export default function BrandLogo({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Crimson Music" style={style}>
      <Svg width="100%" height="100%" viewBox="0 0 320 100" accessible={false}>
        <Defs>
          <ClipPath id="brandIcon"><Rect x="0" y="8" width="84" height="84" rx="22" /></ClipPath>
          <LinearGradient id="brandWordmark" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#C5A8FF" /><Stop offset="1" stopColor="#965CFF" />
          </LinearGradient>
        </Defs>
        <Image href={require('@/assets/images/icon.png')} x="0" y="8" width="84" height="84" clipPath="url(#brandIcon)" />
        <Text x="98" y="51" fontSize="43" fontWeight="700" fontFamily="Helvetica" fill="#F4EEFF">CRIMSON</Text>
        <Text x="100" y="86" fontSize="29" fontWeight="700" fontFamily="Helvetica" fill="url(#brandWordmark)">MUSIC</Text>
      </Svg>
    </View>
  );
}
