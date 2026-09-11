import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import PerformanceStackHeader from '@/components/performance-stack-header';
import { useAppSettings } from '@/providers/settings-provider';

export default function SearchLayout() {
  const { colors, performanceMode, reduceMotion } = useAppSettings();
  return (
    <Stack
      screenOptions={{
        animation: reduceMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
        fullScreenGestureEnabled: true,
        gestureDirection: 'horizontal',
        headerLargeTitleEnabled: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: performanceMode || Platform.OS !== 'ios' ? colors.background : 'transparent' },
        headerBlurEffect: 'none',
        header: performanceMode || Platform.OS !== 'ios' ? (props) => <PerformanceStackHeader {...props} /> : undefined,
        scrollEdgeEffects: performanceMode ? { top: 'hidden', bottom: 'hidden', left: 'hidden', right: 'hidden' } : undefined,
        headerTransparent: Platform.OS === 'ios' && !performanceMode,
        headerTintColor: colors.text,
      }}>
      <Stack.Screen name="search" options={{ headerShown: Platform.OS === 'ios' && !performanceMode, title: '' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="history" options={{ title: 'Listening History' }} />
      <Stack.Screen name="settings" options={{ headerLargeTitleEnabled: true, title: 'Settings' }} />
    </Stack>
  );
}
