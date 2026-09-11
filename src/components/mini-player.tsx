import { FrostedBackdrop } from '@/components/frosted-surface';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { SymbolView } from '@/components/app-symbol';
import {
  ActivityIndicator,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { MINI_PLAYER_HEIGHT } from '@/components/player-layout';
import BouncyPressable from '@/components/bouncy-pressable';
import DownloadStatusIcon from '@/components/download-status-icon';

const fallbackArtwork = require('@/assets/images/home/default-song.webp');

export type MiniPlayerGestureProps = {
  disabled?: boolean;
  onBeginExpand: () => void;
  onExpand: () => void;
  onExpandDrag: (distance: number) => void;
  onExpandRelease: (distance: number, velocity: number) => void;
};

export default function MiniPlayer({ disabled, onBeginExpand, onExpand, onExpandDrag, onExpandRelease }: MiniPlayerGestureProps) {
  const { colors, isDark, performanceMode } = useAppSettings();
  const glassAvailable = !performanceMode && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const {
    currentSong,
    isLiked,
    toggleLike,
    togglePlay,
  } = usePlayer();
  const status = usePlayerStatus();
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy < -2 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onMoveShouldSetPanResponderCapture: (_, gesture) => gesture.dy < -2 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: onBeginExpand,
    onPanResponderMove: (_, gesture) => onExpandDrag(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      onExpandRelease(gesture.dy, gesture.vy);
    },
    onPanResponderTerminate: () => onExpandRelease(0, 0),
  });

  if (!currentSong) return null;

  const progress = status.duration > 0
    ? Math.max(0, Math.min(1, status.currentTime / status.duration))
    : 0;

  return (
    <View
      {...panResponder.panHandlers}
      pointerEvents={disabled ? 'none' : 'auto'}
      style={styles.shell}>
      <View style={styles.glass}>
        {glassAvailable ? <GlassView glassEffectStyle="regular" isInteractive style={StyleSheet.absoluteFill} /> : <FrostedBackdrop radius={23} />}
        <View style={styles.content}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <BouncyPressable
            accessibilityLabel={`Open player for ${currentSong.title}`}
            accessibilityRole="button"
            onPress={onExpand}
            contentStyle={styles.songAreaContent}
            style={styles.songArea}>
            <Image
              contentFit="cover"
              source={currentSong.imageSmall ? { uri: currentSong.imageSmall } : fallbackArtwork}
              style={styles.artwork}
            />
            <View style={styles.copy}>
              <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{currentSong.title}</Text>
              <Text numberOfLines={1} style={[styles.artist, { color: colors.secondaryText }]}>{currentSong.creator}</Text>
            </View>
            <DownloadStatusIcon trackId={currentSong.id} />
          </BouncyPressable>
          <BouncyPressable
            accessibilityLabel={isLiked ? 'Remove current song from favorites' : 'Add current song to favorites'}
            accessibilityRole="button"
            hitSlop={5}
            onPress={() => void toggleLike()}
            style={styles.control}>
            <SymbolView name={isLiked ? 'heart.fill' : 'heart'} size={21} tintColor={isLiked ? colors.accent : colors.text} weight="semibold" />
          </BouncyPressable>
          <BouncyPressable
            accessibilityLabel={status.isBuffering ? 'Loading song' : status.playing ? 'Pause' : 'Play'}
            accessibilityRole="button"
            disabled={status.isBuffering}
            hitSlop={5}
            onPress={togglePlay}
            style={styles.control}>
            {status.isBuffering
              ? <ActivityIndicator color={isDark ? '#FFFFFF' : colors.text} size="small" />
              : <SymbolView name={status.playing ? 'pause.fill' : 'play.fill'} size={20} tintColor={isDark ? '#FFFFFF' : colors.text} weight="bold" />}
          </BouncyPressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    height: MINI_PLAYER_HEIGHT,
    borderRadius: 23,
  },
  glass: { flex: 1, overflow: 'hidden', borderRadius: 23 },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  progressTrack: { position: 'absolute', top: 0, left: 16, right: 16, height: 2, backgroundColor: 'rgba(255,255,255,0.13)' },
  progressFill: { height: 2, borderRadius: 1, backgroundColor: '#B981FF' },
  songArea: { flex: 1, minWidth: 0, height: '100%' },
  songAreaContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8 },
  artwork: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#282331' },
  copy: { flex: 1, minWidth: 0 },
  title: { color: '#F2ECFF', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  artist: { marginTop: 2, color: '#A69FB6', fontSize: 12 },
  control: { width: 38, height: 52, alignItems: 'center', justifyContent: 'center' },
});
