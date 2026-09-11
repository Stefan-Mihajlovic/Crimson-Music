/* eslint-disable react-hooks/immutability */

import { useIsFocused, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PixelRatio, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, ViewStyle } from 'react-native';
import Animated, {
  AnimatedStyle,
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { actionSheetHref, useDetailRoutes } from '@/services/action-sheet';
import { SwipeableArtwork } from '@/components/song-swipe-pager';
import BouncyPressable from '@/components/bouncy-pressable';
import PlayerArtworkBackground from '@/components/player-artwork-background';
import MarqueeText from '@/components/marquee-text';

const playerPalette = {
  accent: '#A66BFF',
  muted: 'rgba(255,255,255,0.66)',
  secondary: 'rgba(255,255,255,0.80)',
  text: '#FFFFFF',
};

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function PlayerScreen() {
  const { currentSong } = usePlayer();
  const focused = useIsFocused();
  return (
    <View style={styles.screen}>
      <PlayerArtworkBackground active={focused} song={currentSong} />
      <PlayerContent />
    </View>
  );
}

export const PLAYER_HORIZONTAL_INSET = 22;

export function getPlayerArtworkLayout(width: number, height: number, safeTop: number, safeBottom = 0) {
  if (width > height) {
    const size = Math.max(90, Math.min(width * 0.37, height - Math.max(safeTop, 18) - Math.max(safeBottom, 18) - 88));
    return { size, x: PLAYER_HORIZONTAL_INSET, y: Math.max(safeTop, 18) + 52 + 16 };
  }
  const horizontalSize = width - PLAYER_HORIZONTAL_INSET * 2;
  const verticalSize = height
    - Math.max(safeTop, 18)
    - Math.max(safeBottom, 18)
    - 354 - Math.max(0, PixelRatio.getFontScale() - 1) * 160;
  const size = Math.min(horizontalSize, Math.max(100, verticalSize));
  return {
    size,
    x: (width - size) / 2,
    y: Math.max(safeTop, 18) + 52 + 27,
  };
}

type PlayerContentProps = {
  artworkHidden?: boolean;
  bodyAnimatedStyle?: AnimatedStyle<ViewStyle>;
  onClose?: () => void;
  topBarAnimatedStyle?: AnimatedStyle<ViewStyle>;
};

export function PlayerContent({
  artworkHidden = false,
  bodyAnimatedStyle,
  onClose,
  topBarAnimatedStyle,
}: PlayerContentProps = {}) {
  const router = useRouter();
  const focused = useIsFocused();
  const { artistHref } = useDetailRoutes();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const {
    autoplayEnabled,
    currentSong,
    playbackError,
    retryPlayback,
    playNext,
    isLiked,
    source,
    toggleAutoplay,
    toggleLike,
  } = usePlayer();

  const artworkSize = useMemo(
    () => getPlayerArtworkLayout(width, height, insets.top, insets.bottom).size,
    [height, insets.bottom, insets.top, width],
  );
  const openPlayerDetails = () => router.push('/player-details');
  const landscape = width > height;

  if (!currentSong) {
    return (
      <View style={styles.empty}>
        <SymbolView name="music.note" size={52} tintColor={playerPalette.accent} />
        <Text style={styles.emptyTitle}>Nothing is playing</Text>
        <Pressable onPress={onClose || (() => router.dismiss())}><Text style={styles.emptyClose}>Close</Text></Pressable>
      </View>
    );
  }

  const openActions = () => router.push(actionSheetHref({
    type: 'song',
    id: currentSong.id,
    title: currentSong.title,
    subtitle: currentSong.creator,
    image: currentSong.imageSmall || currentSong.image,
    artistId: currentSong.artistId,
    playerPresentation: onClose ? 'overlay' : 'modal',
  }));

  return (
    <View style={styles.screen}>
      <View style={[styles.content, { paddingTop: Math.max(insets.top, 18), paddingBottom: Math.max(insets.bottom, 18) }]}>
        <Animated.View style={[styles.topBar, topBarAnimatedStyle]}>
          <BouncyPressable accessibilityLabel="Minimize player" accessibilityRole="button" onPress={onClose || (() => router.dismiss())} style={styles.topButton}>
            <SymbolView name="chevron.down" size={20} tintColor={playerPalette.text} weight="bold" />
          </BouncyPressable>
          <View style={styles.sourceGlass}>
            <Text numberOfLines={1} style={styles.sourceLabel}>PLAYING FROM</Text>
            <Text numberOfLines={1} style={styles.sourceName}>{source}</Text>
          </View>
          <BouncyPressable
            accessibilityLabel="Show song actions"
            accessibilityRole="button"
            onPress={openActions}
            style={styles.topButton}>
            <SymbolView name="line.3.horizontal" size={23} tintColor={playerPalette.text} weight="bold" />
          </BouncyPressable>
        </Animated.View>

        <Animated.View style={[styles.playerBody, landscape && styles.landscapeBody, bodyAnimatedStyle]}>
          <View style={[styles.artworkArea, { height: artworkSize + (landscape ? 32 : 54) }, landscape && { width: artworkSize }]}>
            <View style={[styles.artworkFrame, { width: artworkSize, height: artworkSize }, artworkHidden && styles.artworkPlaceholder]}>
              {!artworkHidden ? (
                <SwipeableArtwork pageGap={(width - artworkSize) / 2 + 8} size={artworkSize} />
              ) : null}
            </View>
          </View>
          <ScrollView style={[styles.controlsScroll, landscape && styles.landscapeControls]} contentContainerStyle={styles.controlsContent} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.songLine}>
            <View style={styles.songCopy}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Song information for ${currentSong.title}`} onPress={openActions}>
                <MarqueeText key={`${currentSong.id}:${currentSong.title}`} text={currentSong.title} textStyle={styles.title} active={focused} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${currentSong.creator}`} disabled={!currentSong.artistId} onPress={() => { if (onClose) onClose(); else router.dismiss(); router.push(artistHref(currentSong.artistId)); }}><Text numberOfLines={2} style={styles.artist}>{currentSong.creator}</Text></Pressable>
            </View>
            <View style={styles.songActions}>
              <BouncyPressable
                accessibilityLabel="Song information and actions"
                accessibilityRole="button"
                onPress={openActions}
                style={styles.songActionButton}>
                <SymbolView name="ellipsis" size={21} style={styles.songActionSymbol} tintColor={playerPalette.text} weight="semibold" />
              </BouncyPressable>
              <BouncyPressable
                accessibilityLabel={isLiked ? 'Remove from favorites' : 'Add to favorites'}
                onPress={() => void toggleLike()}
                style={styles.songActionButton}>
                <SymbolView name={isLiked ? 'heart.fill' : 'heart'} size={22} style={styles.songActionSymbol} tintColor={isLiked ? playerPalette.accent : playerPalette.text} weight="semibold" />
              </BouncyPressable>
            </View>
          </View>

          {playbackError ? <View accessibilityLiveRegion="polite" style={styles.recovery}>
            <Text style={styles.recoveryText}>{playbackError}</Text>
            <View style={styles.recoveryActions}>
              <Pressable accessibilityRole="button" onPress={retryPlayback} style={styles.recoveryButton}><Text style={styles.recoveryButtonText}>Retry</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={playNext} style={styles.recoveryButton}><Text style={styles.recoveryButtonText}>Skip</Text></Pressable>
            </View>
          </View> : null}

          <PlaybackControls />

          <View style={styles.footerActions}>
            <BouncyPressable accessibilityLabel="Show queue" accessibilityRole="button" contentStyle={[styles.footerButtonContent, styles.footerButtonLeft]} onPress={openPlayerDetails} pressedScale={0.92} style={styles.footerButton}>
              <SymbolView name="list.bullet" size={20} tintColor={playerPalette.secondary} />
              <Text style={styles.footerText}>UP NEXT</Text>
            </BouncyPressable>
            <BouncyPressable
              accessibilityLabel={`Turn autoplay ${autoplayEnabled ? 'off' : 'on'}`}
              accessibilityRole="button"
              contentStyle={[styles.footerButtonContent, styles.footerButtonRight]}
              onPress={toggleAutoplay}
              pressedScale={0.92}
              style={styles.footerButton}>
              <Text style={[styles.footerText, autoplayEnabled && styles.footerTextActive]}>AUTOPLAY {autoplayEnabled ? 'ON' : 'OFF'}</Text>
              <SymbolView name="infinity" size={20} tintColor={autoplayEnabled ? playerPalette.accent : playerPalette.muted} weight="bold" />
            </BouncyPressable>
          </View>
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

function PlaybackControls() {
  const {
    isShuffled,
    playNext,
    playPrevious,
    repeatMode,
    seekTo,
    togglePlay,
    toggleRepeat,
    toggleShuffle,
  } = usePlayer();
  const status = usePlayerStatus();
  const [scrubValue, setScrubValue] = useState(0);
  const [seekTrackWidth, setSeekTrackWidth] = useState(0);
  const [showTotalDuration, setShowTotalDuration] = useState(false);
  const scrubbingRef = useRef(false);
  const pendingSeekRef = useRef(0);

  useEffect(() => {
    if (!scrubbingRef.current) setScrubValue(status.currentTime);
  }, [status.currentTime]);

  const updateScrubPosition = (locationX: number) => {
    if (seekTrackWidth <= 0 || status.duration <= 0) return;
    const nextValue = Math.max(0, Math.min(status.duration, (locationX / seekTrackWidth) * status.duration));
    pendingSeekRef.current = nextValue;
    setScrubValue(nextValue);
  };

  const finishScrubbing = () => {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    seekTo(pendingSeekRef.current);
  };

  const adjustScrubPosition = (seconds: number) => {
    const nextValue = Math.max(0, Math.min(status.duration, scrubValue + seconds));
    pendingSeekRef.current = nextValue;
    setScrubValue(nextValue);
    seekTo(nextValue);
  };

  return (
    <>
      <View style={styles.seekArea}>
        <View
          accessibilityActions={[{ name: 'increment', label: 'Forward 10 seconds' }, { name: 'decrement', label: 'Back 10 seconds' }]}
          accessibilityLabel="Playback position"
          accessibilityRole="adjustable"
          accessibilityValue={{ min: 0, max: Math.max(1, Math.round(status.duration)), now: Math.round(scrubValue) }}
          onAccessibilityAction={({ nativeEvent }) => adjustScrubPosition(nativeEvent.actionName === 'increment' ? 10 : -10)}
          onLayout={(event) => setSeekTrackWidth(event.nativeEvent.layout.width)}
          onTouchCancel={finishScrubbing}
          onTouchEnd={finishScrubbing}
          onTouchMove={(event) => updateScrubPosition(event.nativeEvent.locationX)}
          onTouchStart={(event) => {
            scrubbingRef.current = true;
            updateScrubPosition(event.nativeEvent.locationX);
          }}
          style={styles.seekTouchArea}>
          <View style={styles.seekTrack}>
            <View style={[styles.seekFill, { width: `${status.duration > 0 ? Math.min(1, scrubValue / status.duration) * 100 : 0}%` }]} />
          </View>
        </View>
        <View style={styles.times}>
          <Text style={styles.time}>{formatTime(scrubValue)}</Text>
          <BouncyPressable
            accessibilityLabel={showTotalDuration ? 'Show remaining time' : 'Show total duration'}
            accessibilityRole="button"
            contentStyle={styles.durationButtonContent}
            onPress={() => setShowTotalDuration((current) => !current)}
            pressedScale={0.92}
            style={styles.durationButton}>
            <Text style={styles.time}>{showTotalDuration ? formatTime(status.duration) : `-${formatTime(Math.max(0, status.duration - scrubValue))}`}</Text>
          </BouncyPressable>
        </View>
      </View>

      <View style={styles.transportGlass}>
        <TransportButton label={isShuffled ? 'Turn shuffle off' : 'Turn shuffle on'} icon="shuffle" motion="shuffle" active={isShuffled} onPress={toggleShuffle} />
        <TransportButton label="Previous song" icon="backward.fill" motion="backward" onPress={playPrevious} />
        <BouncyPressable accessibilityLabel={status.isBuffering ? 'Cancel loading' : status.playing ? 'Pause' : 'Play'} accessibilityRole="button" contentStyle={styles.playButtonContent} hitSlop={6} onPress={togglePlay} pressedScale={0.8} style={styles.playButton}>
          {status.isBuffering
            ? <ActivityIndicator color="#17121D" size="small" />
            : <SymbolView name={status.playing ? 'pause.fill' : 'play.fill'} size={36} tintColor="#17121D" weight="bold" />}
        </BouncyPressable>
        <TransportButton label="Next song" icon="forward.fill" motion="forward" onPress={playNext} />
        <TransportButton
          label={`Repeat ${repeatMode}`}
          icon="repeat"
          motion="repeat"
          active={repeatMode !== 'none'}
          repeatOne={repeatMode === 'one'}
          onPress={toggleRepeat}
        />
      </View>
    </>
  );
}

function TransportButton({ active, icon, label, motion, onPress, repeatOne = false }: {
  active?: boolean;
  icon: 'shuffle' | 'backward.fill' | 'forward.fill' | 'repeat';
  label: string;
  motion: 'shuffle' | 'backward' | 'forward' | 'repeat';
  onPress: () => void;
  repeatOne?: boolean;
}) {
  const { reduceMotion } = useAppSettings();
  const offset = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const iconStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: offset.value }, { scale: scale.value }],
  }));

  const animateAndPress = () => {
    if (!reduceMotion) {
      if (motion === 'repeat') {
        cancelAnimation(scale);
        scale.value = withSequence(
          withTiming(0.82, { duration: 80, easing: Easing.out(Easing.quad) }),
          withSpring(1, { damping: 13, mass: 0.38, stiffness: 330 }),
        );
      } else {
        const direction = motion === 'backward' ? -1 : 1;
        offset.value = withSequence(
          withTiming(direction * 13, { duration: 105, easing: Easing.in(Easing.cubic) }),
          withTiming(-direction * 13, { duration: 0 }),
          withSpring(0, { damping: 8, mass: 0.38, stiffness: 310 }),
        );
        opacity.value = withSequence(
          withTiming(0, { duration: 105 }),
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: 145 }),
        );
      }
    }
    onPress();
  };

  return (
    <BouncyPressable accessibilityLabel={label} accessibilityRole="button" hitSlop={8} onPress={animateAndPress} style={styles.transportButton}>
      <Animated.View style={[styles.transportIcon, iconStyle]}>
        <SymbolView name={repeatOne ? 'repeat.1' : icon} size={35} tintColor={active ? playerPalette.accent : playerPalette.text} weight="semibold" />
      </Animated.View>
    </BouncyPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: 'transparent' },
  content: { flex: 1, paddingHorizontal: PLAYER_HORIZONTAL_INSET },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerBody: { flex: 1 },
  landscapeBody: { flexDirection: 'row', alignItems: 'flex-start' },
  controlsScroll: { flex: 1, minHeight: 0 },
  controlsContent: { paddingBottom: 8 },
  landscapeControls: { alignSelf: 'stretch', marginLeft: 26, paddingTop: 16 },
  topButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  sourceGlass: { minWidth: 150, maxWidth: 220, minHeight: 44, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 22, paddingHorizontal: 20 },
  sourceLabel: { color: '#9F97AD', fontSize: 9, fontWeight: '700', letterSpacing: 1.15 },
  sourceName: { marginTop: 1, color: '#F3EEFF', fontSize: 13, fontWeight: '700' },
  artworkArea: { flexGrow: 0, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  artworkFrame: { overflow: 'visible', borderRadius: 28, shadowColor: '#000000', shadowOpacity: 0.36, shadowRadius: 28, shadowOffset: { width: 0, height: 14 } },
  artworkPlaceholder: { backgroundColor: 'transparent', shadowOpacity: 0 },
  songLine: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 14 },
  songCopy: { flex: 1, minWidth: 0 },
  title: { color: '#F3EEFF', fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  artist: { marginTop: 2, color: 'rgba(255,255,255,0.78)', fontSize: 16, fontWeight: '500' },
  songActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  songActionButton: { width: 44, height: 48, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  songActionSymbol: { width: 27, height: 27 },
  seekArea: { marginTop: -2 },
  seekTouchArea: { height: 32, justifyContent: 'center' },
  seekTrack: { height: 7, overflow: 'hidden', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.14)' },
  seekFill: { height: 7, borderRadius: 4, backgroundColor: '#A66BFF' },
  times: { marginTop: -2, flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontVariant: ['tabular-nums'] },
  durationButton: { width: 58, height: 24, marginTop: -5, marginRight: -8 },
  durationButtonContent: { alignItems: 'flex-end', paddingRight: 8 },
  transportGlass: { width: '100%', height: 90, marginTop: 4, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 32 },
  transportButton: { width: 42, height: 66, alignItems: 'center', justifyContent: 'center' },
  transportIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 36, backgroundColor: '#FFFFFF' },
  playButtonContent: { width: '100%', height: '100%', borderRadius: 36 },
  footerActions: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerButton: { flex: 1, height: 40 },
  footerButtonContent: { flexDirection: 'row', gap: 7 },
  footerButtonLeft: { justifyContent: 'flex-start', paddingLeft: 4 },
  footerButtonRight: { justifyContent: 'flex-end', paddingRight: 4 },
  footerText: { color: 'rgba(255,255,255,0.80)', fontSize: 10, fontWeight: '700', letterSpacing: 0.55 },
  footerTextActive: { color: '#A66BFF' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 13, backgroundColor: '#08070B' },
  emptyTitle: { color: '#F3EEFF', fontSize: 23, fontWeight: '700' },
  emptyClose: { color: '#B981FF', fontSize: 17, fontWeight: '600' },
  recovery: { marginTop: 8, padding: 12, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.3)' },
  recoveryText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18 },
  recoveryActions: { flexDirection: 'row', gap: 12 },
  recoveryButton: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  recoveryButtonText: { color: '#FFFFFF', fontWeight: '700' },
});
