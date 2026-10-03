import { Platform, Switch, type SwitchProps } from 'react-native';

/** RN Web uses a separate active-thumb prop and otherwise defaults to teal. */
export default function AppSwitch(props: SwitchProps) {
  return <Switch {...props} {...(Platform.OS === 'web' ? {
    thumbColor: props.thumbColor || '#FFFFFF',
    activeThumbColor: props.thumbColor || '#FFFFFF',
  } : {})} />;
}
