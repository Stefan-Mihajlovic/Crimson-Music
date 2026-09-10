import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AuthBackdrop from '@/components/auth-backdrop';
import BrandLogo from '@/components/brand-logo';
import NativeButton from '@/components/native-button';
import { useAuth } from '@/providers/auth-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { CrimsonAuthError } from '@/services/auth';

export default function WelcomeScreen() {
  const { signInWithAudius, user } = useAuth();
  const { colors } = useAppSettings();
  const signingIn = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    if (signingIn.current) return;
    signingIn.current = true;
    setBusy(true);
    setError('');
    try {
      await signInWithAudius();
    } catch (caught) {
      if (!(caught instanceof CrimsonAuthError && caught.code === 'cancelled')) {
        setError(caught instanceof CrimsonAuthError
          ? caught.message
          : 'Could not connect to Audius. Check your connection and try again.');
      }
    } finally {
      signingIn.current = false;
      setBusy(false);
    }
  };

  if (user) return <Redirect href="/" />;

  return (
    <AuthBackdrop>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <BrandLogo style={styles.logo} />
          <Text style={styles.tagline}>Your Audius. A new way to listen.</Text>
        </View>

        <View style={styles.actions}>
          <Text style={styles.title}>Your music comes with you.</Text>
          <Text style={styles.description}>
            Connect your Audius account to listen, explore, and enjoy your library in Crimson.
          </Text>
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
          ) : null}
          <NativeButton
            disabled={busy}
            icon={busy ? <ActivityIndicator color={colors.text} size="small" /> : undefined}
            label={busy ? 'Connecting to Audius…' : 'Login with Audius'}
            onPress={() => void login()}
            size="large"
            testID="login-with-audius"
          />
          <Text style={styles.note}>Sign in securely on Audius to continue.</Text>
        </View>
      </SafeAreaView>
    </AuthBackdrop>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingHorizontal: 24 },
  hero: { flex: 1, alignItems: 'center', paddingTop: 54 },
  logo: { width: 272, height: 88 },
  tagline: { marginTop: 14, color: 'rgba(255,255,255,0.72)', fontSize: 16, letterSpacing: 0.1, textAlign: 'center' },
  actions: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingBottom: 20, gap: 14 },
  title: { color: '#FFFFFF', fontSize: 27, lineHeight: 33, fontWeight: '600', letterSpacing: -0.7, textAlign: 'center' },
  description: { paddingHorizontal: 12, marginBottom: 12, color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  error: { paddingHorizontal: 10, color: '#FF91A2', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  note: { color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
