import { type ReactNode, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useAppSettings } from '@/providers/settings-provider';

/** The shared Home playlist item, including its mobile and desktop sizing. */
export default function HomePlaylistCard({ title, subtitle, desktopWidth = 184, cover, onPress, onLongPress }: {
  title: string;
  subtitle: string;
  desktopWidth?: number;
  cover: (size: number) => ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors, reduceMotion } = useAppSettings();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 960;
  const [hovered, setHovered] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`}
    onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
    onPress={onPress} onLongPress={onLongPress} delayLongPress={350}
    style={({ pressed }) => [styles.card, desktop && [styles.desktopCard, { width: desktopWidth }], desktop && hovered && { backgroundColor: colors.controlSurface }, pressed && styles.pressed, pressed && !reduceMotion && styles.pressedScale]}>
    {cover(desktop ? desktopWidth - 16 : 142)}
    <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title}</Text>
    <Text numberOfLines={1} style={[styles.subtitle, { color: colors.secondaryText }]}>{subtitle}</Text>
  </Pressable>;
}

export const homePlaylistArtworkStyle = {
  borderRadius: 17,
  backgroundColor: '#1F1D23',
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(220,214,247,0.22)',
};

const styles = StyleSheet.create({
  card: { width: 142 }, desktopCard: { padding: 8, borderRadius: 12, alignItems: 'stretch', gap: 0 },
  pressed: { opacity: 0.82 }, pressedScale: { transform: [{ scale: 0.96 }] },
  title: { marginTop: 8, fontSize: 15, fontWeight: '700' }, subtitle: { marginTop: 2, fontSize: 12 },
});
