import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlayerDetailsTab, PlayerDetailsTabsProps } from '@/components/player-details-tabs.types';
import { useAppSettings } from '@/providers/settings-provider';

const tabs: { label: string; value: PlayerDetailsTab }[] = [
  { label: 'UP NEXT', value: 'queue' },
  { label: 'LYRICS', value: 'lyrics' },
  { label: 'RELATED', value: 'related' },
];

export default function PlayerDetailsTabs({ onChange, value }: PlayerDetailsTabsProps) {
  const { colors } = useAppSettings();

  return (
    <View style={[styles.track, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {tabs.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(item.value)}
            style={[
              styles.tab,
              selected && { backgroundColor: colors.accent },
            ]}>
            <Text style={[styles.label, { color: selected ? '#FFFFFF' : colors.secondaryText }]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 56,
    marginTop: 14,
    marginHorizontal: 13,
    marginBottom: 8,
    flexDirection: 'row',
    padding: 5,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
  },
  label: { fontSize: 11, fontWeight: '800' },
});
