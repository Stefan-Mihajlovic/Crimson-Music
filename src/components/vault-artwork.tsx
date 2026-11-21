import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useAppSettings } from '@/providers/settings-provider';

/** Pause decoding when hidden. Scroll frames never rerender Home. */
export default memo(function VaultArtwork({ scrollOffset, bottom }: { scrollOffset: SharedValue<number>; bottom: number }) {
  const focused = useIsFocused();
  const { reduceMotion, performanceMode } = useAppSettings();
  const [visible, setVisible] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    const visibility = () => setAppActive(document.visibilityState !== 'hidden');
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility);
    return () => { subscription.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useAnimatedReaction(() => scrollOffset.value < bottom, (next, previous) => {
    if (next !== previous) scheduleOnRN(setVisible, next);
  }, [bottom]);
  const image = useRef<Image>(null);
  const moving = focused && appActive && visible && !reduceMotion && !performanceMode;
  const syncPlayback = useCallback(() => {
    if (Platform.OS === 'web') return;
    const command = moving ? image.current?.startAnimating() : image.current?.stopAnimating();
    void command?.catch(() => undefined);
  }, [moving]);
  useEffect(syncPlayback, [syncPlayback]);
  // HTML animated images cannot be paused; use the exact first frame there.
  const source = Platform.OS === 'web' && !moving
    ? require('@/assets/images/home/vault-still.webp')
    : require('@/assets/images/home/vault-background.webp');
  return <Image ref={image} testID="vault-artwork" autoplay={false} onLoad={syncPlayback}
    contentFit="cover" source={source} style={StyleSheet.absoluteFill} />;
});
