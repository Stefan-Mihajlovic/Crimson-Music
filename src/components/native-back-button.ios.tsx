import { Button, Host } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  labelStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { useAppSettings } from '@/providers/settings-provider';

export default function NativeBackButton({ onPress }: { onPress: () => void }) {
  const { colors, isDark, performanceMode } = useAppSettings();
  return (
    <View style={{ width: 40, height: 40 }}>
      <Host
        colorScheme={isDark ? 'dark' : 'light'}
        ignoreSafeArea="container"
        style={{ flex: 1 }}>
        <Button
          label="Go back"
          systemImage="chevron.left"
          onPress={onPress}
          modifiers={[
            buttonStyle(performanceMode ? 'bordered' : 'glass'),
            buttonBorderShape('circle'),
            controlSize('regular'),
            labelStyle('iconOnly'),
            tint(colors.text),
          ]}
        />
      </Host>
    </View>
  );
}
