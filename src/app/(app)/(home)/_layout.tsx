import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import PerformanceStackHeader from '@/components/performance-stack-header';
import { useAppSettings } from '@/providers/settings-provider';

export default function HomeLayout() {
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
        headerStyle: { backgroundColor: performanceMode ? colors.background : 'transparent' },
        headerBlurEffect: 'none',
        header: performanceMode ? (props) => <PerformanceStackHeader {...props} /> : undefined,
        scrollEdgeEffects: performanceMode ? { top: 'hidden', bottom: 'hidden', left: 'hidden', right: 'hidden' } : undefined,
        headerTransparent: !performanceMode,
        headerTintColor: colors.text,
      }}>
      <Stack.Screen name="index" options={{ headerShown: Platform.OS === 'ios' && !performanceMode, title: '' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="history" options={{ title: 'Listening History' }} />
      <Stack.Screen name="settings" options={{ headerLargeTitleEnabled: true, title: 'Settings' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="offline-listening" options={{ title: 'Offline Listening' }} />
      <Stack.Screen name="offline-listening-settings" options={{ title: 'Offline Listening Settings' }} />
      <Stack.Screen
        name="edit-profile"
        options={{
          animation: reduceMotion ? 'none' : 'slide_from_bottom',
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTransparent: false,
          presentation: 'formSheet',
          sheetAllowedDetents: [0.92],
          sheetCornerRadius: 28,
          sheetGrabberVisible: true,
          title: 'Audius Profile',
        }}
      />
      <Stack.Screen name="report-bug" options={{ title: 'Report a Bug' }} />
      <Stack.Screen name="licenses" options={{ title: 'Licenses & Attribution' }} />
    </Stack>
  );
}
