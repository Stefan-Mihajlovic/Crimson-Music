import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import PerformanceStackHeader from '@/components/performance-stack-header';
import { useAppSettings } from '@/providers/settings-provider';

export default function AccountLayout() {
  const { colors, performanceMode, reduceMotion } = useAppSettings();
  return (
    <Stack initialRouteName="account" screenOptions={{
      animation: reduceMotion ? 'none' : 'slide_from_right',
      contentStyle: { backgroundColor: colors.background },
      fullScreenGestureEnabled: true,
      headerLargeTitleEnabled: false,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: performanceMode || Platform.OS !== 'ios' ? colors.background : 'transparent' },
      headerTransparent: Platform.OS === 'ios' && !performanceMode,
      headerBlurEffect: 'none',
        header: performanceMode || Platform.OS !== 'ios' ? (props) => <PerformanceStackHeader {...props} /> : undefined,
        scrollEdgeEffects: performanceMode ? { top: 'hidden', bottom: 'hidden', left: 'hidden', right: 'hidden' } : undefined,
      headerTintColor: colors.text,
    }}>
      <Stack.Screen name="account" options={{ headerShown: Platform.OS === 'ios' && !performanceMode, headerLargeTitleEnabled: false, title: '' }} />
      <Stack.Screen name="history" options={{ title: 'Listening History' }} />
      <Stack.Screen name="music-preferences" options={{ headerShown: false, title: 'Music Preferences' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="offline-listening" options={{ title: 'Offline Listening' }} />
      <Stack.Screen name="offline-listening-settings" options={{ title: 'Offline Listening Settings' }} />
      <Stack.Screen name="edit-profile" options={{ title: 'Audius Profile' }} />
      <Stack.Screen name="report-bug" options={{ title: 'Report a Bug' }} />
      <Stack.Screen name="licenses" options={{ title: 'Licenses & Attribution' }} />
    </Stack>
  );
}
