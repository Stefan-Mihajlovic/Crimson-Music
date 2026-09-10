import { Stack, type Href, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSettings } from '@/providers/settings-provider';
import { useDetailRoutes } from '@/services/action-sheet';
import { Type, readableLineHeight } from '@/styles/typography';

export default function PrivacyScreen() {
  const router = useRouter();
  const { historyHref } = useDetailRoutes();
  const { colors } = useAppSettings();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState('');
  const sections = [
    ['Your Audius account', 'Crimson uses Audius login. Your password stays with Audius. Favorites, follows, and playlists are saved to your Audius account; Crimson does not create a separate account or use Firebase.'],
    ['On this device', 'Music preferences, listening history, recap statistics, seen notifications, and downloads stay on this device. They do not sync between Crimson installations. Theme, Data Saver, and motion settings apply to this device.'],
    ['Listening and voice search', 'Streaming and artwork requests go to Audius and its media hosts. Data Saver reduces artwork and discovery requests, not audio bitrate. Voice search uses your device or browser’s speech service and sends recognized search text to Audius.'],
    ['Session security', 'Native apps keep login tokens in the device’s secure credential store. Web sessions use this tab’s session storage. Downloaded music and ordinary local records are not encrypted separately by Crimson.'],
    ['Error reporting', process.env.EXPO_PUBLIC_SENTRY_DSN ? 'This build is configured for optional developer error reporting in release mode. Errors and sampled performance traces may be sent to the build operator’s Sentry project. Passwords and account tokens should never be included in reports.' : 'Remote error reporting is not configured in this build.'],
    ['Clearing data', 'Clear History removes local listening history and recap statistics. Downloads can be removed individually. Clear Data & Disconnect in Account removes this account’s local records and downloads, then logs out. None of these actions deletes your Audius account or changes its library.'],
  ];
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ title: 'Privacy & Local Data', headerShown: true }} />
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
      <Text style={[styles.title, { color: colors.text }]}>Your music. Your data.</Text>
      {sections.map(([title, body]) => <View key={title} style={styles.section}><Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>{title}</Text><Text style={[styles.body, { color: colors.secondaryText }]}>{body}</Text></View>)}
      <Pressable accessibilityRole="button" onPress={() => router.push(historyHref())} style={[styles.action, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}><Text style={{ color: colors.text }}>Manage listening history</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/downloads' as Href)} style={[styles.action, { backgroundColor: colors.controlSurface, borderColor: colors.border }]}><Text style={{ color: colors.text }}>Manage downloads and storage</Text></Pressable>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://github.com/Stefan-Mihajlovic/Crimson-Music/blob/main/docs/PRIVACY.md').catch(() => setError('Could not open the privacy document. Please try again.'))} style={styles.action}><Text style={{ color: colors.accent }}>Read the full privacy document ↗</Text></Pressable>
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.secondaryText }}>{error}</Text>}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, maxWidth: 720, alignSelf: 'center', width: '100%' },
  title: { fontSize: Type.display, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  section: { gap: 6, marginBottom: 12 },
  heading: { fontSize: Type.body, fontWeight: '700' },
  body: { fontSize: Type.body, lineHeight: readableLineHeight(Type.body) },
  action: { minHeight: 48, padding: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
});
