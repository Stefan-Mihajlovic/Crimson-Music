import { ScrollView, StyleSheet, Text } from 'react-native';
import AdvancedSearchFilterControls from '@/components/advanced-search-filters';
import GlassPressable from '@/components/glass-pressable';
import { useAppSettings } from '@/providers/settings-provider';
import type { AdvancedSearchFilters } from '@/services/search-filters';

export type SearchResultFilter = 'all' | 'songs' | 'artists' | 'playlists' | 'events';
const kinds: { id: SearchResultFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'songs', label: 'Songs' }, { id: 'artists', label: 'Artists' },
  { id: 'playlists', label: 'Playlists' }, { id: 'events', label: 'Events' },
];

export default function SearchFilterBar({ visible, selected, advancedFilters, onSelect, onAdvancedChange }: {
  visible: boolean;
  selected: SearchResultFilter;
  advancedFilters: AdvancedSearchFilters;
  onSelect: (kind: SearchResultFilter) => void;
  onAdvancedChange: (filters: AdvancedSearchFilters) => void;
}) {
  const { colors } = useAppSettings();
  if (!visible) return null;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel} contentContainerStyle={styles.filters}>
    <AdvancedSearchFilterControls value={advancedFilters} onChange={onAdvancedChange} />
    {kinds.map((item) => <GlassPressable key={item.id} accessibilityLabel={`Show ${item.label} results`} cornerRadius={18} height={36}
      onPress={() => onSelect(item.id)} tintColor={selected === item.id ? colors.accent : colors.controlSurface}
      contentStyle={styles.content} style={[styles.button, selected === item.id && { backgroundColor: colors.accent }]}>
      <Text style={[styles.text, { color: selected === item.id ? '#FFFFFF' : colors.secondaryText }]}>{item.label}</Text>
    </GlassPressable>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  carousel: { marginHorizontal: -20 },
  filters: { gap: 7, paddingTop: 13, paddingBottom: 3, paddingHorizontal: 20 },
  button: { width: 90, borderRadius: 18, borderCurve: 'continuous' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 13, fontWeight: '600' },
});
