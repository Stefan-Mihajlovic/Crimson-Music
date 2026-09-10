import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/providers/auth-provider';

const callbackResult = WebBrowser.maybeCompleteAuthSession();

export default function AudiusCallbackScreen() {
  const { ready, user } = useAuth();

  // Native AuthSession owns verification and persistence. On web, the browser
  // callback returns the response to the original tab before closing itself.
  if (ready && (Platform.OS !== 'web' || user || callbackResult.type === 'failed')) {
    return <Redirect href="/" />;
  }

  return (
    <View style={styles.screen}>
      <ActivityIndicator color="#B981FF" size="large" />
      <Text accessibilityLiveRegion="polite" style={styles.message}>Finishing your Audius login…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: '#0D0A10' },
  message: { color: '#FFFFFF', fontSize: 16 },
});
