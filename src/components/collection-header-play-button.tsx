import { SymbolView } from '@/components/app-symbol';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
} from 'react-native';

import BouncyPressable from '@/components/bouncy-pressable';
import { useCollectionPlayback } from '@/hooks/use-collection-playback';
import { CrimsonSong } from '@/services/music';

const heroPlaybackButtonTop = 320;
const navigationBarHeight = 44;

export function useCollectionHeaderPlaybackVisibility(enabled: boolean, topInset: number) {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const revealOffset = Math.max(0, heroPlaybackButtonTop - topInset - navigationBarHeight);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextVisible = enabled && event.nativeEvent.contentOffset.y >= revealOffset;
    if (nextVisible === visibleRef.current) return;
    visibleRef.current = nextVisible;
    setVisible(nextVisible);
  }, [enabled, revealOffset]);

  return {
    onScroll,
    visible: enabled && visible,
  };
}

export default function CollectionHeaderPlayButton({
  collectionId,
  collectionName,
  songs,
}: {
  collectionId?: string;
  collectionName: string;
  songs: CrimsonSong[];
}) {
  const { loading, playing, toggleCollectionPlayback } = useCollectionPlayback(songs, collectionName, collectionId);

  return (
    <BouncyPressable
      accessibilityLabel={loading ? `Loading ${collectionName}` : playing ? `Pause ${collectionName}` : `Play ${collectionName}`}
      accessibilityRole="button"
      disabled={loading}
      hitSlop={5}
      onPress={(event) => {
        event.stopPropagation();
        toggleCollectionPlayback();
      }}
      pressedScale={0.86}
      style={styles.button}>
      {loading
        ? <ActivityIndicator color="#17121D" size="small" />
        : <SymbolView name={playing ? 'pause.fill' : 'play.fill'} size={17} tintColor="#17121D" weight="bold" />}
    </BouncyPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
  },
});
