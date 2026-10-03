import { BrandAccent } from '@/constants/brand-accent';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/providers/auth-provider';
import { audiusRedirectUri, completeAudiusLogin, isAudiusLoginPending } from '@/services/audius-session';

export default function AudiusCallbackScreen() {
  const { ready, user } = useAuth();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const [error, setError] = useState('');
  const [leave, setLeave] = useState(false);
  const url = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href
    : `${audiusRedirectUri()}?${new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))}`;
  useEffect(() => {
    if (!ready || user) return;
    // A live native session owns its callback. Recover here only after an OS restart.
    if (Platform.OS !== 'web' && isAudiusLoginPending()) return;
    let active = true;
    void completeAudiusLogin(url).then(() => {
      if (Platform.OS === 'web') window.history.replaceState(null, '', '/oauth/callback');
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Could not finish login. Please try again.'); });
    return () => { active = false; };
  }, [ready, url, user]);
  if (ready && (user || leave || (Platform.OS !== 'web' && isAudiusLoginPending()))) return <Redirect href="/" />;
  return <View style={styles.screen}>
    {error ? <>
      <Text accessibilityLiveRegion="polite" style={styles.message}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => setLeave(true)} style={styles.retry}><Text style={styles.message}>Back to login</Text></Pressable>
    </> : <><ActivityIndicator color={BrandAccent.dark} size="large" /><Text accessibilityLiveRegion="polite" style={styles.message}>Finishing your Audius login…</Text></>}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 28, backgroundColor: '#0D0A10' },
  message: { color: '#FFFFFF', fontSize: 16, textAlign: 'center' },
  retry: { padding: 18, borderRadius: 24, backgroundColor: '#493266' },
});
