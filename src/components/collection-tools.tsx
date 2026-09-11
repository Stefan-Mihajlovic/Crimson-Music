import { SymbolView } from '@/components/app-symbol';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LiquidSearchField from '@/components/liquid-search-field';
import { useAppSettings } from '@/providers/settings-provider';
import type { CrimsonSong } from '@/types/music';

export type SongSort = 'original' | 'title' | 'artist' | 'recent';
export function collectionSongs(
  songs: CrimsonSong[],
  query: string,
  sort: SongSort,
) {
  const normalized = query.trim().toLocaleLowerCase();
  const result = songs.filter(
    (song) =>
      !normalized ||
      `${song.title} ${song.creator}`.toLocaleLowerCase().includes(normalized),
  );
  if (sort === 'title') result.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'artist')
    result.sort(
      (a, b) =>
        a.creator.localeCompare(b.creator) || a.title.localeCompare(b.title),
    );
  if (sort === 'recent')
    result.sort(
      (a, b) =>
        (Date.parse(b.releaseDate) || 0) - (Date.parse(a.releaseDate) || 0),
    );
  return result;
}
export function collectionDuration(songs: CrimsonSong[]) {
  const minutes = Math.max(
    0,
    Math.round(
      songs.reduce((total, song) => total + (song.duration || 0), 0) / 60,
    ),
  );
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
    : `${minutes} min`;
}
export function shuffledSongs(songs: CrimsonSong[]) {
  const result = [...songs];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
export default function CollectionTools({
  query = '',
  onQueryChange,
  sort,
  onSortChange,
  onShuffle,
  disabled = false,
  showSearch = true,
  horizontalInset = 22,
}: {
  query?: string;
  onQueryChange?: (value: string) => void;
  sort: SongSort;
  onSortChange: (sort: SongSort) => void;
  onShuffle: () => void;
  disabled?: boolean;
  showSearch?: boolean;
  horizontalInset?: number;
}) {
  const { colors } = useAppSettings();
  return (
    <View style={[styles.tools, !showSearch && styles.compactTools]}>
      {showSearch && onQueryChange ? (
        <View style={{ marginHorizontal: horizontalInset }}>
          <LiquidSearchField
            placeholder="Find in this collection"
            value={query}
            onChangeText={onQueryChange}
          />
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.options, { paddingHorizontal: horizontalInset }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Shuffle this collection"
          disabled={disabled}
          onPress={onShuffle}
          style={[
            styles.option,
            {
              backgroundColor: colors.controlSurface,
              borderColor: colors.border,
            },
            disabled && { opacity: 0.4 },
          ]}
        >
          <SymbolView name="shuffle" size={16} tintColor={colors.text} />
          <Text style={[styles.label, { color: colors.text }]}>Shuffle</Text>
        </Pressable>
        {(['original', 'title', 'artist', 'recent'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: sort === value }}
            onPress={() => onSortChange(value)}
            style={[
              styles.option,
              {
                backgroundColor:
                  sort === value ? colors.accentSoft : colors.controlSurface,
                borderColor: sort === value ? colors.accent : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: sort === value ? colors.accent : colors.secondaryText,
                },
              ]}
            >
              {value === 'original'
                ? 'Original order'
                : value === 'title'
                  ? 'Title'
                  : value === 'artist'
                    ? 'Artist'
                    : 'Newest release'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  tools: { paddingTop: 16, paddingBottom: 12, gap: 10 },
  compactTools: { paddingTop: 4 },
  options: { gap: 8 },
  option: {
    minHeight: 40,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 13, fontWeight: '600' },
});
