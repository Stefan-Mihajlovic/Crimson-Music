import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import ArtworkImage from '@/components/artwork-image';
import { usePlayer } from '@/providers/player-provider';

/** A compact queue for the spare space on an unfolded phone or tablet. */
export default function AdaptivePlayerQueue() {
  const { queue, queueIndex, playQueueIndex } = usePlayer();
  const upcoming = queue.slice(queueIndex + 1);
  return <View style={styles.panel}>
    <Text accessibilityRole="header" style={styles.heading}>Up next</Text>
    <FlatList data={upcoming} keyExtractor={(song, index) => `${song.id}:${index}`}
      initialNumToRender={5} maxToRenderPerBatch={5} windowSize={3}
      ListEmptyComponent={<Text style={styles.secondary}>You’re all caught up.</Text>}
      renderItem={({ item, index }) => <Pressable accessibilityRole="button" accessibilityLabel={`Play ${item.title} by ${item.creator}`}
        onPress={() => playQueueIndex(queueIndex + 1 + index)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
        <ArtworkImage source={item.imageSmall || item.image} artwork={item.artwork} style={styles.cover} />
        <View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{item.title}</Text><Text numberOfLines={1} style={styles.secondary}>{item.creator}</Text></View>
      </Pressable>} />
  </View>;
}
const styles = StyleSheet.create({
  panel: { height: 210, marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,.15)', paddingTop: 14 },
  heading: { color: '#FFFFFF', fontWeight: '700', fontSize: 18, marginBottom: 12 },
  row: { minHeight: 52, flexDirection: 'row', gap: 12, alignItems: 'center' },
  cover: { width: 36, height: 36, borderRadius: 7 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  secondary: { color: 'rgba(255,255,255,.65)', fontSize: 12, marginTop: 3 },
});
