import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppSettings } from '@/providers/settings-provider';

const credits = [
  { title: 'Audius API', subtitle: 'Music catalog and streaming powered by Audius', url: 'https://docs.audius.co/api/' },
  { title: 'Abstract shapes (liquid 2)', subtitle: 'CC BY 4.0 · Кристина', url: 'https://www.figma.com/@kristi_k0s' },
  { title: '3D Christmas Metallic Icons', subtitle: 'CC BY 4.0 · RLVNT Studios', url: 'https://www.figma.com/@rlvntstudios' },
  { title: 'Electronic category photo', subtitle: 'Unsplash · Vitalii Onyshchuk', url: 'https://unsplash.com/photos/gySsQUlY_y8?utm_source=crimson_music&utm_medium=referral' },
  { title: 'Hip-Hop/Rap category photo', subtitle: 'Unsplash · Laszlo Barta', url: 'https://unsplash.com/photos/tXy86Sb1juQ?utm_source=crimson_music&utm_medium=referral' },
  { title: 'Pop category photo', subtitle: 'Unsplash · Batuhan Doğan', url: 'https://unsplash.com/photos/hjRdNrqV7Hc?utm_source=crimson_music&utm_medium=referral' },
  { title: 'R&B/Soul category photo', subtitle: 'Unsplash · Clout Africa', url: 'https://unsplash.com/photos/3SGveU4wWLA?utm_source=crimson_music&utm_medium=referral' },
  { title: 'Rock category photo', subtitle: 'Unsplash · William White', url: 'https://unsplash.com/photos/NDGzkMIasJQ?utm_source=crimson_music&utm_medium=referral' },
  { title: 'Ambient category photo', subtitle: 'Unsplash · Daniil Silantev', url: 'https://unsplash.com/photos/3pW91fGAKiE?utm_source=crimson_music&utm_medium=referral' },
  { title: 'Jazz category photo', subtitle: 'Unsplash · dimitri.photography', url: 'https://unsplash.com/photos/BY_KyTwTKq4?utm_source=crimson_music&utm_medium=referral' },
  { title: 'Classical category photo', subtitle: 'Unsplash · Ayako', url: 'https://unsplash.com/photos/cv1zLZ7j9jw?utm_source=crimson_music&utm_medium=referral' },
  { title: 'Reggae category photo', subtitle: 'Unsplash · Debra Fisher', url: 'https://unsplash.com/photos/PPLpumj7ibA?utm_source=crimson_music&utm_medium=referral' },
  { title: 'Podcasts category photo', subtitle: 'Unsplash · Flipsnack', url: 'https://unsplash.com/photos/kl6ia5PyWP4?utm_source=crimson_music&utm_medium=referral' },
  { title: 'Events category photo', subtitle: 'Unsplash · Nicolás Flor', url: 'https://unsplash.com/photos/u0eSZmbk-H0?utm_source=crimson_music&utm_medium=referral' },
  { title: 'Feeling lucky discovery photo', subtitle: 'Unsplash · Mick Haupt', url: 'https://unsplash.com/photos/mH_DxfDAFI0?utm_source=crimson_music&utm_medium=referral' },
  { title: 'Underground discovery photo', subtitle: 'Unsplash · Valentin Bolder', url: 'https://unsplash.com/photos/BZOtLUdDcoU?utm_source=crimson_music&utm_medium=referral' },
  { title: 'Most shared discovery photo', subtitle: 'Unsplash · Jonathan Ikemura', url: 'https://unsplash.com/photos/z0R4XB25ozI?utm_source=crimson_music&utm_medium=referral' },
];

export default function LicensesScreen() {
  const { colors } = useAppSettings();
  return <View style={[styles.screen, { backgroundColor: colors.background }]}><Stack.Screen options={{ title: 'Licenses & Attribution' }} /><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <Text style={[styles.intro, { color: colors.secondaryText }]}>Services, artwork, and visual resources used by Crimson Music.</Text>
    <View style={[styles.group, { backgroundColor: colors.controlSurface }]}>{credits.map((item, index) => <Pressable key={item.title} onPress={() => void Linking.openURL(item.url)} style={({ pressed }) => [styles.row, index > 0 && [styles.divider, { borderTopColor: colors.border }], pressed && [styles.pressed, { backgroundColor: colors.accentSoft }]]}><View style={styles.copy}><Text style={[styles.title, { color: colors.text }]}>{item.title}</Text><Text style={[styles.subtitle, { color: colors.secondaryText }]}>{item.subtitle}</Text></View><SymbolView name="arrow.up.right" size={16} tintColor={colors.accent} /></Pressable>)}</View>
  </ScrollView></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#0E0D13' }, content: { padding: 18, paddingBottom: 180 }, intro: { marginBottom: 18, color: '#9B93A2', fontSize: 15, lineHeight: 21 }, group: { overflow: 'hidden', borderRadius: 21, backgroundColor: '#1C1921' }, row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17 }, divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' }, copy: { flex: 1 }, title: { color: '#F5EFFF', fontSize: 16, fontWeight: '600' }, subtitle: { marginTop: 4, color: '#928B9B', fontSize: 13 }, pressed: { backgroundColor: 'rgba(255,255,255,0.06)' } });
