import AsyncStorage from '@react-native-async-storage/async-storage';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, LayoutChangeEvent, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlayerStatus } from '@/providers/player-provider';
import { useAppSettings } from '@/providers/settings-provider';
import { KaraokeLine, KaraokeWord, karaokeEaseCurve, karaokeLineText } from '@/services/karaoke';

const karaokePreferenceKey = 'crimson.player.karaoke.v1';

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function lineIndexes(lines: KaraokeLine[], currentTime: number) {
  const activeLineIndex = lines.findIndex((line) => currentTime >= line.startTime && currentTime < line.endTime);
  let focusLineIndex = activeLineIndex;
  if (focusLineIndex < 0) {
    focusLineIndex = lines.findIndex((line) => currentTime < line.endTime);
    if (focusLineIndex < 0) focusLineIndex = lines.length - 1;
  }
  const activeWordIndex = activeLineIndex < 0
    ? -1
    : lines[activeLineIndex].words.findIndex((word) => currentTime >= word.start && currentTime < word.start + word.duration);
  return { activeLineIndex, activeWordIndex, focusLineIndex };
}

export default function PlayerLyricsView({ karaoke, lyrics }: { karaoke: KaraokeLine[]; lyrics: string[] }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppSettings();
  const [karaokeEnabled, setKaraokeEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(karaokePreferenceKey)
      .then((stored) => { if (active) setKaraokeEnabled(stored === 'on'); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const setMode = useCallback((enabled: boolean) => {
    setKaraokeEnabled(enabled);
    void AsyncStorage.setItem(karaokePreferenceKey, enabled ? 'on' : 'off');
  }, []);

  const modeBar = karaoke.length ? (
    <View style={[styles.modeBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.modeCopy}>
        <View style={styles.modeTitleRow}>
          <Text style={[styles.modeTitle, { color: colors.text }]}>Karaoke</Text>
          <Text style={[styles.beta, { color: colors.accent, borderColor: colors.accent }]}>BETA</Text>
        </View>
        <Text style={[styles.modeSubtitle, { color: colors.secondaryText }]}>Word-by-word synchronized lyrics</Text>
      </View>
      <View style={styles.modeToggle}>
        <Text style={[styles.modeState, { color: karaokeEnabled ? colors.accent : colors.secondaryText }]}>{karaokeEnabled ? 'On' : 'Off'}</Text>
        <Switch accessibilityLabel="Toggle karaoke lyrics" onValueChange={setMode} value={karaokeEnabled} trackColor={{ false: colors.surfaceStrong, true: colors.accent }} />
      </View>
    </View>
  ) : null;

  if (!karaokeEnabled || !karaoke.length) {
    return (
      <View style={styles.screen}>
        {modeBar}
        <FlatList
          alwaysBounceVertical
          contentContainerStyle={[styles.plainLyrics, { paddingBottom: insets.bottom + 38 }]}
          data={lyrics}
          initialNumToRender={12}
          ItemSeparatorComponent={LyricSeparator}
          keyExtractor={(_, index) => String(index)}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.secondaryText }]}>No lyrics available for this song.</Text>}
          renderItem={({ item }) => <Text style={[styles.plainLine, { color: colors.text }]}>{item || ' '}</Text>}
          showsVerticalScrollIndicator={false}
          windowSize={7}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {modeBar}
      <KaraokeLyricsList lines={karaoke} />
    </View>
  );
}

function KaraokeLyricsList({ lines }: { lines: KaraokeLine[] }) {
  const insets = useSafeAreaInsets();
  const status = usePlayerStatus();
  const { reduceMotion } = useAppSettings();
  const listRef = useRef<FlatList<KaraokeLine>>(null);
  const manualScrollUntilRef = useRef(0);
  const indexes = useMemo(() => lineIndexes(lines, status.currentTime), [lines, status.currentTime]);
  const renderRevision = `${indexes.activeLineIndex}:${indexes.focusLineIndex}:${indexes.activeWordIndex}:${status.playing}:${Math.round(status.currentTime * 10)}`;

  useEffect(() => {
    if (indexes.focusLineIndex < 0 || Date.now() < manualScrollUntilRef.current) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        animated: !reduceMotion,
        index: indexes.focusLineIndex,
        viewPosition: 0.3,
      });
    });
  }, [indexes.focusLineIndex, reduceMotion]);

  const renderKaraokeLine = useCallback(({ item, index }: { item: KaraokeLine; index: number }) => {
    const active = index === indexes.activeLineIndex;
    const past = status.currentTime >= item.endTime;
    return (
      <KaraokeLineView
        active={active}
        activeWordIndex={active ? indexes.activeWordIndex : -1}
        currentTime={active ? status.currentTime : past ? item.endTime : item.startTime - 0.001}
        focused={index === indexes.focusLineIndex}
        line={item}
        near={Math.abs(index - indexes.focusLineIndex) === 1}
        past={past}
        playing={active && status.playing}
        reduceMotion={reduceMotion}
      />
    );
  }, [indexes.activeLineIndex, indexes.activeWordIndex, indexes.focusLineIndex, reduceMotion, status.currentTime, status.playing]);

  return (
    <FlatList
      ref={listRef}
      alwaysBounceVertical
      contentContainerStyle={[styles.karaokeLyrics, { paddingBottom: insets.bottom + 150 }]}
      data={lines}
      extraData={renderRevision}
      initialNumToRender={8}
      ItemSeparatorComponent={KaraokeSeparator}
      keyExtractor={(line) => String(line.lineId)}
      onScrollBeginDrag={() => { manualScrollUntilRef.current = Date.now() + 1800; }}
      onScrollToIndexFailed={({ averageItemLength, index }) => {
        listRef.current?.scrollToOffset({ animated: false, offset: Math.max(0, averageItemLength * index) });
      }}
      removeClippedSubviews
      renderItem={renderKaraokeLine}
      showsVerticalScrollIndicator={false}
      windowSize={7}
    />
  );
}

type KaraokeLineViewProps = {
  active: boolean;
  activeWordIndex: number;
  currentTime: number;
  focused: boolean;
  line: KaraokeLine;
  near: boolean;
  past: boolean;
  playing: boolean;
  reduceMotion: boolean;
};

const KaraokeLineView = memo(function KaraokeLineView({
  active,
  activeWordIndex,
  currentTime,
  focused,
  line,
  near,
  past,
  playing,
  reduceMotion,
}: KaraokeLineViewProps) {
  const { colors } = useAppSettings();
  const lineColor = active || focused ? colors.text : colors.secondaryText;
  return (
    <View
      accessible
      accessibilityLabel={karaokeLineText(line)}
      style={[
        styles.karaokeLine,
        { opacity: active || focused ? 1 : near ? 0.52 : past ? 0.28 : 0.42 },
        active && styles.karaokeLineActive,
      ]}>
      {line.words.map((word, index) => {
        const wordActive = active && index === activeWordIndex;
        const wordComplete = past || (active && index < activeWordIndex);
        return (
          <KaraokeWordView
            key={`${line.lineId}-${index}`}
            active={wordActive}
            color={lineColor}
            complete={wordComplete}
            currentTime={wordActive ? currentTime : wordComplete ? word.start + word.duration : word.start - 0.001}
            playing={wordActive && playing}
            reduceMotion={reduceMotion}
            word={word}
          />
        );
      })}
    </View>
  );
}, (previous, next) => {
  const stableState = previous.active === next.active
    && previous.activeWordIndex === next.activeWordIndex
    && previous.focused === next.focused
    && previous.line === next.line
    && previous.near === next.near
    && previous.past === next.past
    && previous.playing === next.playing
    && previous.reduceMotion === next.reduceMotion;
  if (!stableState) return false;
  return next.active && next.playing ? true : previous.currentTime === next.currentTime;
});

type KaraokeWordViewProps = {
  active: boolean;
  color: string;
  complete: boolean;
  currentTime: number;
  playing: boolean;
  reduceMotion: boolean;
  word: KaraokeWord;
};

const KaraokeWordView = memo(function KaraokeWordView({
  active,
  color,
  complete,
  currentTime,
  playing,
  reduceMotion,
  word,
}: KaraokeWordViewProps) {
  const [wordWidth, setWordWidth] = useState(0);
  const progress = useSharedValue(complete ? 1 : 0);
  const activeShared = useSharedValue(active ? 1 : 0);
  const longWordWeight = clampProgress((word.duration - 0.32) / 0.78);

  useEffect(() => {
    const rawProgress = clampProgress((currentTime - word.start) / word.duration);
    progress.value = rawProgress;
    activeShared.value = active ? 1 : 0;
    if (active && playing && !reduceMotion) {
      const [x1, y1, x2, y2] = karaokeEaseCurve(word.ease);
      progress.value = withTiming(1, {
        duration: Math.max(0, (word.start + word.duration - currentTime) * 1000),
        easing: Easing.bezier(x1, y1, x2, y2),
      });
    } else {
      progress.value = withTiming(complete ? 1 : rawProgress, { duration: reduceMotion ? 0 : 90 });
    }
  }, [active, activeShared, complete, currentTime, playing, progress, reduceMotion, word.duration, word.ease, word.start]);

  const fillStyle = useAnimatedStyle(() => ({ width: wordWidth * progress.value }));
  const jellyStyle = useAnimatedStyle(() => {
    if (!activeShared.value || reduceMotion) return { transform: [{ translateY: 0 }, { scaleX: 1 }, { scaleY: 1 }] };
    const pulse = Math.sin(Math.PI * progress.value);
    const settle = Math.sin(Math.PI * 2 * progress.value) * (1 - progress.value);
    return {
      transform: [
        { translateY: -longWordWeight * (pulse * 1.15 + settle * 0.2) },
        { scaleX: 1 + longWordWeight * (pulse * 0.072 + settle * 0.018) },
        { scaleY: 1 - longWordWeight * (pulse * 0.034 + settle * 0.006) },
      ],
    };
  });

  const captureWidth = useCallback((event: LayoutChangeEvent) => {
    setWordWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <Animated.View style={[styles.word, jellyStyle]}>
      <Text onLayout={captureWidth} style={[styles.wordText, { color }]}>{word.text}</Text>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.wordFillClip, fillStyle]}>
        <Text style={[styles.wordText, styles.wordFill, { width: wordWidth }]}>{word.text}</Text>
      </Animated.View>
    </Animated.View>
  );
}, (previous, next) => {
  const stableState = previous.active === next.active
    && previous.color === next.color
    && previous.complete === next.complete
    && previous.playing === next.playing
    && previous.reduceMotion === next.reduceMotion
    && previous.word === next.word;
  if (!stableState) return false;
  return next.active && next.playing ? true : previous.currentTime === next.currentTime;
});

function KaraokeSeparator() {
  return <View style={styles.karaokeSeparator} />;
}

function LyricSeparator() {
  return <View style={styles.lyricSeparator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  modeBar: { minHeight: 58, marginHorizontal: 13, marginVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 19 },
  modeCopy: { flex: 1, minWidth: 0 },
  modeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeTitle: { fontSize: 13, lineHeight: 16, fontWeight: '800' },
  modeSubtitle: { marginTop: 2, fontSize: 10, lineHeight: 12 },
  beta: { paddingHorizontal: 5, paddingVertical: 3, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, fontSize: 8, lineHeight: 9, fontWeight: '800', letterSpacing: 0.6 },
  modeToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  modeState: { minWidth: 18, fontSize: 11, fontWeight: '800' },
  plainLyrics: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 15 },
  plainLine: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  lyricSeparator: { height: 25 },
  karaokeLyrics: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 34 },
  karaokeSeparator: { height: 24 },
  karaokeLine: { minHeight: 42, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', paddingVertical: 4, transform: [{ scale: 0.985 }] },
  karaokeLineActive: { transform: [{ scale: 1.012 }] },
  word: { position: 'relative', marginRight: 8, marginBottom: 3, transformOrigin: 'left center' },
  wordText: { fontSize: 30, lineHeight: 37, fontWeight: '800', letterSpacing: -0.6 },
  wordFillClip: { position: 'absolute', top: 0, left: 0, bottom: 0, overflow: 'hidden' },
  wordFill: { color: '#FFFFFF', textShadowColor: 'rgba(170,106,255,0.78)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 9 },
  empty: { padding: 24, fontSize: 15 },
});
