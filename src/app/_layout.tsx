import { ModalBackdropProvider, ModalBackdropScene } from '@/components/modal-backdrop';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import OfflineModeBanner from '@/components/offline-mode-banner';
import PerformanceStackHeader from '@/components/performance-stack-header';
import WebAppShell from '@/components/web-app-shell';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { DownloadProvider } from '@/providers/download-provider';
import { NetworkProvider, useNetwork } from '@/providers/network-provider';
import { PlayerProvider } from '@/providers/player-provider';
import { SettingsProvider, useAppSettings } from '@/providers/settings-provider';
import { configureAppTypography } from '@/styles/typography';
import { reportError, wrap } from '@/services/telemetry';

SplashScreen.preventAutoHideAsync();
configureAppTypography();

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NetworkProvider>
        <AuthProvider>
          <SettingsProvider>
            <DownloadProvider>
              <ThemedApp />
            </DownloadProvider>
          </SettingsProvider>
        </AuthProvider>
      </NetworkProvider>
    </GestureHandlerRootView>
  );
}

export default wrap(RootLayout);

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error, 'root-render');
    void SplashScreen.hideAsync();
  }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: '#17070D', justifyContent: 'center', padding: 28, gap: 20 }}>
      <Text accessibilityRole="header" style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700' }}>Something went wrong</Text>
      <Text style={{ color: '#D8D0E3', fontSize: 16 }}>Crimson could not display this screen. Please try again.</Text>
      <Pressable accessibilityRole="button" onPress={() => void retry()} style={{ padding: 18, borderRadius: 16, backgroundColor: '#E8DFFF' }}>
        <Text style={{ color: '#17121D', textAlign: 'center', fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

function ThemedApp() {
  const { colors, isDark } = useAppSettings();
  const navigationTheme = isDark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.background, text: colors.text, border: colors.border, primary: colors.accent } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, card: colors.background, text: colors.text, border: colors.border, primary: colors.accent } };

  return (
    <PlayerProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ModalBackdropProvider><WebAppShell><RootNavigator /></WebAppShell></ModalBackdropProvider>
        <OfflineModeBanner />
      </ThemeProvider>
    </PlayerProvider>
  );
}

function RootNavigator() {
  const { ready, user } = useAuth();
  const network = useNetwork();
  const { colors, performanceMode, reduceMotion } = useAppSettings();

  useEffect(() => {
    if (ready && network.ready) {
      SplashScreen.hideAsync();
    }
  }, [network.ready, ready]);

  if (!ready || !network.ready) {
    return null;
  }

  return (
    <Stack
      screenLayout={({ children, route }) => ['action-sheet', 'player-details'].includes(route.name)
        ? children : <ModalBackdropScene>{children}</ModalBackdropScene>}
      screenOptions={{
        header: performanceMode || Platform.OS !== 'ios' ? (props) => <PerformanceStackHeader {...props} /> : undefined,
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: reduceMotion ? 'none' : 'fade_from_bottom',
        gestureEnabled: true,
      }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="oauth/callback" options={{ animation: 'none' }} />
      <Stack.Screen
        name="onboarding"
        options={({ route }) => {
          const isEditing = (route.params as { mode?: string } | undefined)?.mode === 'edit';
          return {
            animation: reduceMotion ? 'none' : isEditing ? 'slide_from_bottom' : 'fade',
            contentStyle: { backgroundColor: colors.background },
            presentation: isEditing ? 'fullScreenModal' : 'card',
          };
        }}
      />
      <Stack.Protected guard={!user}>
        <Stack.Screen name="welcome" options={{ animation: reduceMotion ? 'none' : 'fade' }} />
        <Stack.Screen name="sign-in" options={{ animation: reduceMotion ? 'none' : 'slide_from_right' }} />
        <Stack.Screen name="register" options={{ animation: reduceMotion ? 'none' : 'slide_from_right' }} />
        <Stack.Screen name="reset-password" options={{ animation: reduceMotion ? 'none' : 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="(app)" options={{ animation: 'none' }} />
      </Stack.Protected>
      <Stack.Screen
        name="artist"
        options={{
          animation: reduceMotion ? 'none' : 'slide_from_right',
          presentation: 'card',
          gestureDirection: 'horizontal',
          fullScreenGestureEnabled: true,
          headerShown: true,
          headerTransparent: Platform.OS === 'ios',
          headerStyle: { backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.background },
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: 'minimal',
          headerLargeTitleEnabled: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      <Stack.Screen
        name="playlist"
        options={{
          animation: reduceMotion ? 'none' : 'slide_from_right',
          presentation: 'card',
          gestureDirection: 'horizontal',
          fullScreenGestureEnabled: true,
          headerShown: true,
          headerTransparent: Platform.OS === 'ios',
          headerStyle: { backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.background },
          headerTintColor: colors.text,
          headerBackButtonDisplayMode: 'minimal',
          headerLargeTitleEnabled: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
      {['category', 'favorites', 'privacy', 'downloads'].map((name) => (
        <Stack.Screen
          key={name}
          name={name}
          options={{
            animation: reduceMotion ? 'none' : 'slide_from_right',
            presentation: 'card',
            gestureDirection: 'horizontal',
            fullScreenGestureEnabled: true,
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerStyle: { backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.background },
            headerTintColor: colors.text,
            headerBackButtonDisplayMode: 'minimal',
            headerLargeTitleEnabled: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      ))}
      <Stack.Screen
        name="action-sheet"
        options={{
          presentation: Platform.OS === 'web' ? 'transparentModal' : 'formSheet',
          animation: Platform.OS === 'web' || reduceMotion ? 'none' : 'slide_from_bottom',
          contentStyle: { backgroundColor: Platform.OS === 'web' ? 'transparent' : Platform.OS === 'ios' || performanceMode ? colors.elevated : 'transparent' },
          sheetAllowedDetents: [0.5, 1.0],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
          sheetExpandsWhenScrolledToEdge: true,
        }}
      />
      <Stack.Screen
        name="player-details"
        options={{
          presentation: Platform.OS === 'web' ? 'transparentModal' : 'formSheet',
          animation: Platform.OS === 'web' || reduceMotion ? 'none' : 'slide_from_bottom',
          contentStyle: { backgroundColor: Platform.OS === 'web' ? 'transparent' : Platform.OS === 'ios' || performanceMode ? colors.elevated : 'transparent' },
          sheetAllowedDetents: [0.62, 1.0],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
          sheetExpandsWhenScrolledToEdge: true,
        }}
      />
      <Stack.Screen
        name="player"
        options={{
          presentation: Platform.OS === 'web' ? 'transparentModal' : 'fullScreenModal',
          animation: Platform.OS === 'web' || reduceMotion ? 'none' : 'slide_from_bottom',
          contentStyle: { backgroundColor: Platform.OS === 'web' ? 'transparent' : colors.background },
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}
