import { StyleSheet, View } from 'react-native';

import { useAppSettings } from '@/providers/settings-provider';

export default function ClearGlassCircle({ size = 104 }: { size?: number }) {
  const { colors } = useAppSettings();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.controlSurface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }} />
  );
}
