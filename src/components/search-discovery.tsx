import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import BouncyPressable from '@/components/bouncy-pressable';
import { useAuth } from '@/providers/auth-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { getAudiusDiscoveryMix, type AudiusDiscoveryMix } from '@/services/audius';
import { getCurrentAudiusUserId } from '@/services/audius-session';
import { BROWSE_PAGE_INSET, BROWSE_TILE_GAP, BROWSE_TILE_HEIGHT, BROWSE_TILE_RADIUS, browseTileWidth } from '@/styles/browse-tiles';

const mixes: {
  id: AudiusDiscoveryMix;
  title: string;
  subtitle: string;
  image: number;
}[] = [
  { id: 'lucky', title: 'Feeling lucky', subtitle: 'Play a surprise mix', image: require('@/assets/images/discovery/feeling-lucky.jpg') },
  { id: 'underground', title: 'Underground', subtitle: 'Play rising tracks', image: require('@/assets/images/discovery/underground.jpg') },
  { id: 'most-shared', title: 'Most shared', subtitle: 'Play this week’s picks', image: require('@/assets/images/discovery/most-shared.jpg') },
];

export default function SearchDiscovery() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  return <AccountSearchDiscovery key={uid || 'guest'} uid={uid} />;
}

function AccountSearchDiscovery({ uid }: { uid: string | null }) {
  const { width } = useWindowDimensions();
  const { colors } = useAppSettings();
  const { playSong } = usePlayer();
  const [loading, setLoading] = useState<AudiusDiscoveryMix | null>(null);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const pending = useRef(false);

  useFocusEffect(useCallback(() => {
    setLoading(null);
    pending.current = false;
    return () => {
      // A slow discovery request must not start music after leaving Search.
      revision.current += 1;
      pending.current = false;
    };
  }, []));

  const startMix = async (mix: typeof mixes[number]) => {
    if (pending.current) return;
    pending.current = true;
    const token = ++revision.current;
    setLoading(mix.id);
    setError('');
    try {
      const songs = await getAudiusDiscoveryMix(mix.id);
      if (token !== revision.current || uid !== (getCurrentAudiusUserId() || null)) return;
      if (!songs.length) throw new Error('No playable tracks');
      playSong(songs[0], songs, mix.title, '', false);
    } catch {
      if (token === revision.current) setError(`Couldn’t load ${mix.title.toLowerCase()}. Tap to try again.`);
    } finally {
      if (token === revision.current) {
        pending.current = false;
        setLoading(null);
      }
    }
  };

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Discover something new</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel} contentContainerStyle={styles.cards}>
        {mixes.map((mix) => (
          <BouncyPressable
            key={mix.id}
            accessibilityRole="button"
            accessibilityLabel={`${mix.title}. ${mix.subtitle}`}
            accessibilityState={{ busy: loading === mix.id, disabled: loading !== null }}
            disabled={loading !== null}
            onPress={() => void startMix(mix)}
            pressedScale={0.96}
            style={[styles.card, { width: browseTileWidth(width) }]}
            contentStyle={styles.cardContent}>
            <Image source={mix.image} contentFit="cover" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(9,5,17,0.05)', 'rgba(9,5,17,0.82)']} locations={[0.15, 1]} style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={styles.playButton}>
              {loading === mix.id ? <ActivityIndicator color="#251B36" size="small" /> : <SymbolView name="play.fill" size={13} resizeMode="scaleAspectFit" tintColor="#251B36" style={styles.playSymbol} />}
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.title}>{mix.title}</Text>
          </BouncyPressable>
        ))}
      </ScrollView>
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.secondaryText }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  heading: { fontSize: 23, fontWeight: '700', marginBottom: 14 },
  carousel: { marginHorizontal: -BROWSE_PAGE_INSET },
  cards: { paddingHorizontal: BROWSE_PAGE_INSET, gap: BROWSE_TILE_GAP },
  card: { height: BROWSE_TILE_HEIGHT, borderRadius: BROWSE_TILE_RADIUS, overflow: 'hidden' },
  cardContent: { alignItems: 'stretch', justifyContent: 'flex-end', padding: 13 },
  playButton: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  playSymbol: { width: 13, height: 13 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  error: { fontSize: 13, marginTop: 12 },
});
