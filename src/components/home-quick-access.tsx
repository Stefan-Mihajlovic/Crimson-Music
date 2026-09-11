import { Image } from 'expo-image';
import ArtworkImage from '@/components/artwork-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from '@/components/app-symbol';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import PlaylistCover from '@/components/playlist-cover';
import { useAuth } from '@/providers/auth-provider';
import { useDownloads } from '@/providers/download-provider';
import { useNetwork } from '@/providers/network-provider';
import { usePlayer } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { useDetailRoutes } from '@/services/action-sheet';
import { buildLibraryCollection, type LibraryCollectionItem } from '@/services/library-collection';
import {
  loadListeningHistoryPage,
  readLocalListeningEvents,
  readOfflineData,
  type LibraryFeed,
  type CrimsonSong,
} from '@/services/music';

export default function HomeQuickAccess() {
  const { user } = useAuth();
  return <AccountQuickAccess key={user?.uid || 'guest'} uid={user?.uid} />;
}

function AccountQuickAccess({ uid }: { uid?: string }) {
  const { colors } = useAppSettings();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  const [contentWidth, setContentWidth] = useState(0);
  const [hovered, setHovered] = useState('');
  const { isOffline } = useNetwork();
  const { playSong } = usePlayer();
  const { downloadedSongs, supported: downloadsSupported } = useDownloads();
  const routes = useDetailRoutes();
  const router = useRouter();
  const [recent, setRecent] = useState<CrimsonSong[]>([]);
  const [collections, setCollections] = useState<LibraryCollectionItem[]>([]);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!uid) return;
    void Promise.all([
      loadListeningHistoryPage(uid, null, 4),
      readOfflineData<LibraryFeed>(`library:${uid}`),
      readLocalListeningEvents(uid),
    ]).then(([page, library, events]) => {
      if (!active) return;
      setRecent(page.items.map((item) => item.song));
      setCollections(library
        ? buildLibraryCollection(library, events).filter((item) => item.kind !== 'favorites').slice(0, 3)
        : []);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [uid]));

  const available = isOffline ? downloadedSongs : recent;
  const items = [
    ...(!isOffline ? collections : []),
    ...available,
  ].slice(0, 3);
  const fallbackShortcuts = [
    downloadsSupported
      ? { title: 'Downloads', icon: 'arrow.down.circle' as const, onPress: () => router.push('/downloads') }
      : { title: 'Search', icon: 'magnifyingglass' as const, onPress: () => router.push('/(app)/(search)/search') },
    { title: 'Recently played', icon: 'clock' as const, onPress: () => router.push(routes.historyHref()) },
    { title: 'Your library', icon: 'square.stack' as const, onPress: () => router.push('/(app)/(library)/library') },
  ];
  const tileStyle = (key: string) => [styles.tile, { backgroundColor: colors.controlSurface, borderColor: colors.border },
    desktop && [styles.desktopTile, { width: contentWidth >= 780 ? '24.1%' as const : '48.6%' as const }],
    desktop && hovered === key && { backgroundColor: colors.accentSoft }];

  return (
    <View onLayout={({ nativeEvent: { layout } }) => setContentWidth(layout.width)} style={styles.section}>
      <View style={styles.grid}>
        <Pressable accessibilityRole="button" onPress={() => router.push(routes.favoritesHref())} onHoverIn={() => setHovered('favorites')} onHoverOut={() => setHovered('')} style={tileStyle('favorites')}>
          <Image contentFit="cover" source={require('@/assets/images/onboarding/favorites.webp')} style={styles.smallCover} />
          <Text numberOfLines={2} style={[styles.tileTitle, { color: colors.text }]}>Favorites</Text>
        </Pressable>
        {items.map((item) => {
          if ('kind' in item) {
            if (item.kind === 'favorites') return null;
            const artist = item.kind === 'artist';
            const title = artist ? item.artist.name : item.playlist.title;
            return (
              <Pressable key={item.key} accessibilityRole="button" onHoverIn={() => setHovered(item.key)} onHoverOut={() => setHovered('')} style={tileStyle(item.key)}
                onPress={() => router.push(artist
                  ? routes.artistHref(item.artist.id)
                  : routes.playlistHref(item.playlist.id, item.owned, item.playlist.source, item.playlist.title))}>
                {artist ? <ArtworkImage artwork={item.artist.artwork} fallbackSource={require('@/assets/images/home/default-artist.webp')} contentFit="cover" source={item.artist.imageSmall || item.artist.image
                  ? { uri: item.artist.imageSmall || item.artist.image }
                  : require('@/assets/images/home/default-artist.webp')}
                  style={[styles.smallCover, styles.artistCover]} />
                  : <PlaylistCover playlist={item.playlist} showPlayingIndicator={false} borderRadius={10} style={styles.smallCover} />}
                <Text numberOfLines={2} style={[styles.tileTitle, { color: colors.text }]}>{title}</Text>
              </Pressable>
            );
          }
          return (
            <Pressable key={`song:${item.id}`} accessibilityRole="button" onHoverIn={() => setHovered(item.id)} onHoverOut={() => setHovered('')} style={tileStyle(item.id)}
              onPress={() => playSong(item, available, isOffline ? 'Downloads' : 'Recently played')}>
              <ArtworkImage artwork={item.artwork} contentFit="cover" source={{ uri: item.imageSmall || item.image }} style={styles.smallCover} />
              <Text numberOfLines={2} style={[styles.tileTitle, { color: colors.text }]}>{item.title}</Text>
            </Pressable>
          );
        })}
        {fallbackShortcuts.slice(0, 3 - items.length).map((item) => (
          <Pressable key={item.title} accessibilityRole="button" onPress={item.onPress} onHoverIn={() => setHovered(item.title)} onHoverOut={() => setHovered('')} style={tileStyle(item.title)}>
            <View style={[styles.smallCover, styles.iconCover, { backgroundColor: colors.accentSoft }]}>
              <SymbolView name={item.icon} size={23} tintColor={colors.accent} />
            </View>
            <Text numberOfLines={2} style={[styles.tileTitle, { color: colors.text }]}>{item.title}</Text>
          </Pressable>
        ))}
      </View>
      {isOffline ? <Text style={{ color: colors.secondaryText }}>
        {downloadedSongs.length ? 'Your saved music is ready offline.' : 'Connect to discover music, or save songs for next time.'}
      </Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  desktopTile: { borderRadius: 8, borderWidth: 0, minHeight: 62, gap: 12, padding: 8 },
  section: { gap: 12, marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { width: '48.6%', flexDirection: 'row', alignItems: 'center', gap: 9,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 8, minHeight: 62 },
  smallCover: { height: 42, width: 42, borderRadius: 10 },
  artistCover: { borderRadius: 21 },
  iconCover: { alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
});
