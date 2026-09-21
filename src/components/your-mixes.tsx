import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import HomePlaylistCard, { homePlaylistArtworkStyle } from '@/components/home-playlist-card';
import PersonalMixCover from '@/components/personal-mix-cover';
import { usePersonalMixes } from '@/hooks/use-personal-mixes';
import { useAppSettings } from '@/providers/settings-provider';
import { personalMixDefinitions, type PersonalMix } from '@/services/personal-mixes';

export function YourMixesSection({ mixes, loading, error, refresh, desktopCardWidth }: {
  mixes: PersonalMix[];
  loading: boolean;
  error: boolean;
  refresh: () => void;
  desktopCardWidth?: number;
}) {
  const router = useRouter();
  const { colors } = useAppSettings();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Your Mixes</Text>
    <Text style={[styles.subtitle, { color: colors.secondaryText }]}>Made for your day, your week, your month.</Text>
    <ScrollView horizontal alwaysBounceHorizontal bounces showsHorizontalScrollIndicator={false} style={styles.carousel} contentContainerStyle={[styles.cards, desktop && styles.desktopCards]}>
      {personalMixDefinitions.map((definition) => {
        const mix = mixes.find((item) => item.id === definition.id);
        const artists = [...new Set(mix?.songs.map((song) => song.creator).filter(Boolean))].slice(0, 3).join(', ');
        const subtitle = mix?.stale ? 'Your last edition' : loading && !mix ? 'Preparing your mix…' : mix?.status === 'error' ? 'Tap to retry' : mix?.status === 'offline' ? 'Connect to create this mix' : artists || (definition.id === 'rediscover' ? 'From your favorites' : definition.id === 'release-radar' ? 'From artists you follow' : `Updated ${definition.period}`);
        return <HomePlaylistCard key={definition.id} title={definition.title} subtitle={subtitle} desktopWidth={desktopCardWidth}
          cover={(size) => <PersonalMixCover id={definition.id} songs={mix?.songs} size={size} style={homePlaylistArtworkStyle} />}
          onPress={() => router.push({ pathname: '/(app)/(home)/mix', params: { id: definition.id } })} />;
      })}
    </ScrollView>
    {error ? <Pressable accessibilityRole="button" onPress={refresh} style={{ paddingVertical: 12 }}><Text style={{ color: colors.accent }}>Could not load your mixes. Try again.</Text></Pressable> : null}
  </View>;
}

export default function YourMixes({ desktopCardWidth }: { desktopCardWidth?: number }) {
  return <YourMixesSection {...usePersonalMixes()} desktopCardWidth={desktopCardWidth} />;
}

const styles = StyleSheet.create({
  section: { marginTop: 24 }, title: { fontSize: 22, lineHeight: 26, fontWeight: '700', letterSpacing: -0.45 },
  subtitle: { marginTop: 4, marginBottom: 10, fontSize: 12, lineHeight: 16 },
  carousel: { marginHorizontal: -20 }, cards: { paddingHorizontal: 20, gap: 11 }, desktopCards: { gap: 16, paddingBottom: 6 },
});
