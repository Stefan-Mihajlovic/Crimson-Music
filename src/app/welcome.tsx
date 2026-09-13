import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AuthBackdrop from '@/components/auth-backdrop';
import BrandLogo from '@/components/brand-logo';
import { useAuth } from '@/providers/auth-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { CrimsonAuthError } from '@/services/auth';

export default function WelcomeScreen() {
  const { signInWithAudius, user } = useAuth();
  const { reduceMotion } = useAppSettings();
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
        </View>

        <View style={styles.actions}>
          <Text style={styles.title}>Your music comes with you.</Text>
          <Text style={styles.description}>
            Connect your Audius account to listen, explore, and enjoy your library in Crimson.
          </Text>
          {error ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={busy ? 'Connecting to Audius…' : 'Login with Audius'}
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => void login()}
            style={({ pressed }) => [styles.loginButton, busy && styles.loginDisabled,
              pressed && [styles.loginPressed, !reduceMotion && styles.loginPressedScale]]}
            testID="login-with-audius"
          >
            {busy ? <ActivityIndicator color="#100D17" size="small" /> : null}
            <Text style={styles.loginLabel}>{busy ? 'Connecting to Audius…' : 'Login with Audius'}</Text>
          </Pressable>
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
  actions: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingBottom: 20, gap: 14 },
  title: { color: '#FFFFFF', fontSize: 27, lineHeight: 33, fontWeight: '600', letterSpacing: -0.7, textAlign: 'center' },
  description: { paddingHorizontal: 12, marginBottom: 12, color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  error: { paddingHorizontal: 10, color: '#FF91A2', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  loginButton: { width: '100%', minHeight: 56, paddingHorizontal: 24, paddingVertical: 16,
    borderRadius: 28, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loginLabel: { color: '#100D17', fontSize: 16, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  loginDisabled: { opacity: 0.65 },
  loginPressed: { opacity: 0.9 },
  loginPressedScale: { transform: [{ scale: 0.98 }] },
  note: { color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
