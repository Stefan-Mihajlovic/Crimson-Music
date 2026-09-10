import { PropsWithChildren } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

export type GlassPressableProps = PropsWithChildren<{
  accessibilityLabel: string;
  onPress: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  disabled?: boolean;
  cornerRadius?: number;
  height?: number;
  prominent?: boolean;
  shape?: 'capsule' | 'circle' | 'roundedRectangle';
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;
