import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

export type NativeButtonTone = 'primary' | 'accent' | 'secondary' | 'text' | 'google';

export type NativeButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  size?: 'regular' | 'large';
  tone?: NativeButtonTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
