import type { ComponentProps } from 'react';
import type FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { socialPaths } from '@/components/icons/social-paths';

export default function SocialIcon({ name, size = 16, color = '#FFFFFF', style }: ComponentProps<typeof FontAwesome6>) {
  const glyph = socialPaths[name as keyof typeof socialPaths] || socialPaths['arrow-up-right-from-square'];
  return (
    <View aria-hidden style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${glyph.width} 512`} aria-hidden>
        <Path d={glyph.path} fill={color} />
      </Svg>
    </View>
  );
}
