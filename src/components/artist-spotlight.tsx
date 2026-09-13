import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { SymbolView } from '@/components/app-symbol';
import ArtworkImage from '@/components/artwork-image';
import { CollectionPlayingOverlay } from '@/components/now-playing-artwork';
import { useAppSettings } from '@/providers/settings-provider';
import type { CrimsonArtist, CrimsonSong } from '@/types/music';

const defaultArtistImage = require('@/assets/images/home/default-artist.webp');

export type ArtistSpotlightProps = {
  artist: CrimsonArtist;
  songs: CrimsonSong[];
  loading?: boolean;
  onPlay: () => void;
  onOpen: () => void;
  onMenu?: () => void;
};

export default function ArtistSpotlight({ artist, songs, loading = false, onPlay, onOpen, onMenu }: ArtistSpotlightProps) {
  const { isDark, reduceMotion } = useAppSettings();
  const [wide, setWide] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const imageKey = `${artist.id}:${artist.image}`;
  const canPlay = !loading && songs.some((song) => song.streamable);
  const bio = artist.description?.replace(/\s+/g, ' ').trim();
  const surface = isDark ? '#180D2B' : '#281340';

  return (
    <View
      testID="artist-spotlight"
      onLayout={(event) => setWide(event.nativeEvent.layout.width >= 600)}
      style={[styles.card, wide && styles.wideCard, { backgroundColor: surface, borderColor: isDark ? 'rgba(177,138,255,0.2)' : 'rgba(109,40,217,0.28)' }]}
    >
      <View pointerEvents="none" style={[styles.imageWrap, wide && styles.wideImageWrap]}>
        <ArtworkImage
          accessibilityIgnoresInvertColors
          accessible={false}
          artwork={artist.artwork}
          fallbackSource={defaultArtistImage}
          cachePolicy="memory-disk"
          contentFit="cover"
          contentPosition="center"
          recyclingKey={imageKey}
          transition={reduceMotion ? 0 : 180}
          source={artist.image && failedImage !== imageKey ? { uri: artist.image } : defaultArtistImage}
          onError={() => {
            // Web ArtworkImage tries its mirrors itself; native needs a local fallback.
            if (Platform.OS !== 'web') setFailedImage(imageKey);
          }}
          style={StyleSheet.absoluteFill}
        />
        <CollectionPlayingOverlay sourceName={artist.name} spectrumSize={50} />
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={[surface, isDark ? 'rgba(24,13,43,0.94)' : 'rgba(40,19,64,0.94)', 'rgba(29,12,52,0.28)', 'rgba(29,12,52,0.08)']}
        locations={[0, wide ? 0.36 : 0.3, 0.76, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(16,9,28,0)', 'rgba(16,9,28,0.3)', 'rgba(16,9,28,0.94)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, wide && styles.wideContent]}>
        <View style={[styles.copy, wide && styles.wideCopy]}>
          <Text accessibilityRole="header" numberOfLines={2} style={[styles.name, wide && styles.wideName]}>{artist.name}</Text>
          {artist.followers ? <Text style={styles.followers}>{artist.followers} followers</Text> : null}
          {bio ? <Text numberOfLines={2} style={styles.bio}>{bio}</Text> : null}
        </View>

        <View style={styles.actions}>
          {canPlay ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Play ${artist.name}`}
              onPress={onPlay}
              style={({ pressed }) => [styles.playButton, pressed && styles.playPressed, pressed && !reduceMotion && styles.buttonScale]}
            >
              <SymbolView name="play.fill" size={18} tintColor="#1B102A" />
              <Text style={styles.playText}>Play</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${artist.name}'s profile`}
            onPress={onOpen}
            style={({ pressed }) => [styles.profileButton, pressed && styles.profilePressed]}
          >
            <Text style={styles.profileText}>View profile</Text>
            <SymbolView name="chevron.right" size={14} tintColor="#F3ECFF" />
          </Pressable>
        </View>
      </View>

      {onMenu ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More options for ${artist.name}`}
          onPress={onMenu}
          style={({ pressed }) => [styles.menuButton, pressed && styles.profilePressed]}
        >
          <SymbolView name="ellipsis" size={21} tintColor="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', minHeight: 280, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  wideCard: { minHeight: 270, borderRadius: 28 },
  imageWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '76%' },
  wideImageWrap: { width: '58%' },
  content: { flexGrow: 1, minHeight: 280, padding: 22, justifyContent: 'space-between', gap: 24 },
  wideContent: { minHeight: 270, paddingHorizontal: 32, paddingVertical: 28 },
  copy: { width: '78%', gap: 8, paddingTop: 4 },
  wideCopy: { width: '58%', paddingTop: 0 },
  name: { color: '#FFFFFF', fontSize: 30, lineHeight: 34, fontWeight: '800', letterSpacing: -0.8 },
  wideName: { fontSize: 36, lineHeight: 41, letterSpacing: -1 },
  followers: { color: '#D5C4EA', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  bio: { color: '#EEE5F8', fontSize: 14, lineHeight: 20, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  playButton: { minHeight: 48, minWidth: 112, paddingHorizontal: 23, paddingVertical: 12, borderRadius: 99, backgroundColor: '#FFFFFF', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  playText: { color: '#1B102A', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  playPressed: { backgroundColor: '#E9DCFF' },
  buttonScale: { transform: [{ scale: 0.97 }] },
  profileButton: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 99, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  profileText: { color: '#F3ECFF', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  profilePressed: { backgroundColor: 'rgba(177,138,255,0.18)' },
  menuButton: { position: 'absolute', top: 12, right: 12, minWidth: 44, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,9,28,0.36)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
});
