import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';

export type { SymbolViewProps } from 'expo-symbols';

/** Bundled glyphs keep controls visible on Android/web, including offline. */
export const symbolIcons = {
  'antenna.radiowaves.left.and.right': 'radio-outline',
  'arrow.down': 'arrow-down',
  'arrow.down.circle': 'arrow-down-circle-outline',
  'arrow.up': 'arrow-up',
  'arrow.up.arrow.down': 'swap-vertical',
  'arrow.up.left': 'arrow-back',
  'arrow.up.right': 'arrow-up-right-box-outline',
  'backward.fill': 'play-skip-back',
  bell: 'notifications-outline',
  'bell.fill': 'notifications',
  'bolt.fill': 'flash',
  calendar: 'calendar-outline',
  checkmark: 'checkmark',
  'checkmark.circle.fill': 'checkmark-circle',
  'chevron.down': 'chevron-down',
  'chevron.left': 'chevron-back',
  'chevron.right': 'chevron-forward',
  'chevron.left.forwardslash.chevron.right': 'code-slash',
  'circle.lefthalf.filled': 'contrast-outline',
  clock: 'time-outline',
  'clock.arrow.circlepath': 'time-outline',
  'clock.fill': 'time',
  'cloud.rain.fill': 'rainy',
  'doc.text.fill': 'document-text',
  ellipsis: 'ellipsis-horizontal',
  'exclamationmark.triangle': 'warning-outline',
  'exclamationmark.triangle.fill': 'warning',
  'figure.walk.motion': 'walk-outline',
  'flame.fill': 'flame',
  folder: 'folder-outline',
  'folder.fill': 'folder',
  'forward.fill': 'play-skip-forward',
  globe: 'globe-outline',
  'hand.raised.fill': 'hand-left',
  heart: 'heart-outline',
  'heart.fill': 'heart',
  house: 'home-outline',
  'house.fill': 'home',
  'icloud.and.arrow.down': 'cloud-download-outline',
  'icloud.and.arrow.down.fill': 'cloud-download',
  'icloud.slash': 'cloud-offline-outline',
  'icloud.slash.fill': 'cloud-offline',
  infinity: 'infinite',
  'internaldrive.fill': 'server',
  'line.3.horizontal': 'menu',
  link: 'link',
  'list.bullet': 'list',
  lock: 'lock-closed-outline',
  magnifyingglass: 'search',
  'mic.fill': 'mic',
  'minus.circle': 'remove-circle-outline',
  'moon.stars.fill': 'moon',
  'music.note': 'musical-note',
  'music.note.list': 'musical-notes',
  'pause.fill': 'pause',
  pencil: 'pencil',
  person: 'person-outline',
  'person.2.fill': 'people',
  'person.crop.circle': 'person-circle-outline',
  'person.crop.circle.fill': 'person-circle',
  'person.fill': 'person',
  'play.fill': 'play',
  plus: 'add',
  'plus.circle': 'add-circle-outline',
  'plus.circle.fill': 'add-circle',
  'rectangle.portrait.and.arrow.right': 'log-out-outline',
  'rectangle.stack.fill': 'albums',
  repeat: 'repeat',
  'repeat.1': 'repeat',
  scope: 'locate-outline',
  shuffle: 'shuffle',
  'slider.horizontal.3': 'options-outline',
  sparkles: 'sparkles',
  'square.grid.2x2': 'grid-outline',
  'square.stack': 'albums-outline',
  'text.line.first.and.arrowtriangle.forward': 'return-up-forward',
  'text.line.last.and.arrowtriangle.forward': 'return-down-forward',
  'trash.fill': 'trash',
  'trophy.fill': 'trophy',
  'wand.and.stars': 'color-wand',
  waveform: 'pulse',
  wifi: 'wifi',
  'wifi.slash': 'cloud-offline-outline',
  xmark: 'close',
} satisfies Record<string, ComponentProps<typeof Ionicons>['name']>;

export function SymbolView({ name, size = 24, tintColor, style, fallback, ...props }: SymbolViewProps) {
  const symbol = typeof name === 'string' ? name : name.ios;
  const icon = symbolIcons[symbol as keyof typeof symbolIcons];
  if (!icon && fallback) return <>{fallback}</>;
  return (
    <View
      accessible={Boolean(props.accessibilityLabel)}
      accessibilityLabel={props.accessibilityLabel}
      accessibilityRole={props.accessibilityLabel ? 'image' : undefined}
      pointerEvents="none"
      style={[{ width: size, height: size }, styles.frame, style]}
      testID={props.testID}>
      <Ionicons accessible={false} aria-hidden name={icon || 'help-circle-outline'} size={size} color={tintColor} style={styles.icon} />
      {symbol === 'repeat.1' ? (
        <Text accessible={false} aria-hidden style={[styles.repeatOne, { color: tintColor, fontSize: size * 0.3 }]}>1</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon: { textAlign: 'center', includeFontPadding: false },
  repeatOne: { position: 'absolute', fontWeight: '800', includeFontPadding: false },
});
