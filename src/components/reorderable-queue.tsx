import { SymbolView } from 'expo-symbols';
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { FlatList, type FlatListProps, type ViewProps, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation, measure, scrollTo, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler,
  useAnimatedStyle, useDerivedValue, useFrameCallback, useSharedValue, withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useAppSettings } from '@/providers/settings-provider';
import type { CrimsonSong } from '@/types/music';

export type QueueEntry = { key: string; song: CrimsonSong; index: number };
type DragState = {
  source: SharedValue<number>;
  target: SharedValue<number>;
  offset: SharedValue<number>;
  rowHeight: number;
  reduceMotion: boolean;
  backgroundColor: string;
};
const AnimatedQueueList = Animated.createAnimatedComponent(FlatList<QueueEntry>);
const DragContext = createContext<DragState | null>(null);

// Animate the list cell itself so the lifted row draws above its neighbors.
function QueueCell({ children, index, style, onLayout }: ViewProps & { index: number }) {
  const drag = useContext(DragContext)!;
  const animatedStyle = useAnimatedStyle(() => {
    const from = drag.source.get();
    const to = drag.target.get();
    const active = from === index;
    const shifted = from >= 0 && index !== from
      ? from < to && index > from && index <= to ? -drag.rowHeight
        : from > to && index >= to && index < from ? drag.rowHeight : 0
      : 0;
    return {
      transform: [{ translateY: active ? drag.offset.get() : from < 0 || drag.reduceMotion ? shifted : withTiming(shifted, { duration: 160 }) }],
      zIndex: active ? 10 : 0,
      elevation: active ? 8 : 0,
      shadowOpacity: active ? 0.24 : 0,
    };
  });
  return <Animated.View onLayout={onLayout}
    style={[style, styles.cell, { height: drag.rowHeight, backgroundColor: drag.backgroundColor }, animatedStyle]}>
    {children}
  </Animated.View>;
}

export default function ReorderableQueue({ items, editing, onMove, renderRow, ...listProps }: {
  items: QueueEntry[];
  editing: boolean;
  onMove: (from: number, to: number) => void;
  renderRow: (item: QueueEntry, handle: ReactElement | null) => ReactElement;
} & Pick<FlatListProps<QueueEntry>, 'ListHeaderComponent' | 'ListFooterComponent' | 'contentContainerStyle'>) {
  const { colors, reduceMotion } = useAppSettings();
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(76, Math.ceil(38 * fontScale + 24));
  const list = useAnimatedRef<FlatList<QueueEntry>>();
  const [dragging, setDragging] = useState(false);
  const source = useSharedValue(-1);
  const target = useSharedValue(-1);
  const translation = useSharedValue(0);
  const startScroll = useSharedValue(0);
  const scrollOffset = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const touching = useSharedValue(false);
  const contentHeight = useSharedValue(0);
  const latestItems = useRef(items);
  const maximum = Math.max(0, items.length - 1);
  const offset = useDerivedValue(() => {
    const from = source.get();
    if (from < 0) return 0;
    return Math.max(-from * rowHeight, Math.min((maximum - from) * rowHeight,
      translation.get() + scrollOffset.get() - startScroll.get()));
  });
  useDerivedValue(() => {
    if (source.get() >= 0) target.set(Math.max(0, Math.min(maximum, source.get() + Math.round(offset.get() / rowHeight))));
  });
  // Mirror the UI-thread gesture state only when a drag starts or ends.
  useAnimatedReaction(() => source.get() >= 0, (active, previous) => {
    if (active !== previous) scheduleOnRN(setDragging, active);
  });
  const resetDrag = useCallback(() => {
    cancelAnimation(translation);
    touching.set(false);
    source.set(-1);
    target.set(-1);
    translation.set(0);
  }, [source, target, touching, translation]);

  useLayoutEffect(() => {
    latestItems.current = items;
    // Playback, deletion, or a committed move invalidates the old drag indices.
    resetDrag();
  }, [items, editing, resetDrag]);

  const commit = useCallback((from: number, to: number) => {
    if (latestItems.current === items && items[from] && items[to] && from !== to) {
      onMove(items[from].index, items[to].index);
    } else resetDrag();
  }, [items, onMove, resetDrag]);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollOffset.set(event.contentOffset.y);
  });
  useFrameCallback((frame) => {
    if (!touching.get()) return;
    const bounds = measure(list);
    if (!bounds) return;
    const edge = Math.min(72, bounds.height / 4);
    const y = pointerY.get() - bounds.pageY;
    const speed = y < edge ? -Math.min(1, (edge - y) / edge)
      : y > bounds.height - edge ? Math.min(1, (y - bounds.height + edge) / edge) : 0;
    if (!speed) return;
    const next = Math.max(0, Math.min(Math.max(0, contentHeight.get() - bounds.height),
      scrollOffset.get() + speed * Math.min(frame.timeSincePreviousFrame || 16, 32) * 0.48));
    scrollTo(list, 0, next, false);
  });
  const context = useMemo(() => ({ source, target, offset, rowHeight, reduceMotion, backgroundColor: colors.elevated }),
    [source, target, offset, rowHeight, reduceMotion, colors.elevated]);

  return <DragContext.Provider value={context}>
    <AnimatedQueueList
      {...listProps}
      ref={list}
      data={items}
      extraData={editing}
      keyExtractor={(item) => item.key}
      CellRendererComponent={QueueCell}
      style={styles.list}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      scrollEnabled={!dragging}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onContentSizeChange={(_, height) => contentHeight.set(height)}
      removeClippedSubviews={false}
      initialNumToRender={12}
      windowSize={dragging ? 51 : 9}
      renderItem={({ item, index }) => renderRow(item, editing ? <QueueHandle
        title={item.song.title}
        index={index}
        maximum={maximum}
        source={source}
        target={target}
        translation={translation}
        startScroll={startScroll}
        scrollOffset={scrollOffset}
        pointerY={pointerY}
        touching={touching}
        rowHeight={rowHeight}
        reduceMotion={reduceMotion}
        onCommit={commit}
        onCancel={resetDrag}
      /> : null)}
    />
  </DragContext.Provider>;
}

function QueueHandle({ title, index, maximum, source, target, translation, startScroll, scrollOffset, pointerY, touching,
  rowHeight, reduceMotion, onCommit, onCancel }: {
  title: string; index: number; maximum: number; rowHeight: number; reduceMotion: boolean;
  source: SharedValue<number>; target: SharedValue<number>; translation: SharedValue<number>;
  startScroll: SharedValue<number>; scrollOffset: SharedValue<number>; pointerY: SharedValue<number>; touching: SharedValue<boolean>;
  onCommit: (from: number, to: number) => void; onCancel: () => void;
}) {
  const { colors } = useAppSettings();
  const gesture = useMemo(() => Gesture.Pan()
    .activeOffsetY([-2, 2])
    .onStart((event) => {
      cancelAnimation(translation);
      startScroll.set(scrollOffset.get());
      translation.set(0);
      source.set(index);
      target.set(index);
      pointerY.set(event.absoluteY);
      touching.set(true);
    })
    .onUpdate((event) => {
      translation.set(event.translationY);
      pointerY.set(event.absoluteY);
    })
    .onEnd(() => {
      touching.set(false);
      const destination = target.get();
      const finalTranslation = (destination - index) * rowHeight - scrollOffset.get() + startScroll.get();
      translation.set(withTiming(finalTranslation, { duration: reduceMotion ? 0 : 140 }, (finished) => {
        if (finished) scheduleOnRN(onCommit, index, destination);
      }));
    })
    .onFinalize((_, success) => {
      if (!success && touching.get()) {
        touching.set(false);
        scheduleOnRN(onCancel);
      }
    }), [index, onCancel, onCommit, pointerY, reduceMotion, rowHeight, scrollOffset, source, startScroll, target, touching, translation]);

  return <GestureDetector gesture={gesture}>
    <Animated.View accessible accessibilityLabel={`Reorder ${title}`} accessibilityHint="Drag to move this song in the queue"
      accessibilityRole="adjustable"
      accessibilityActions={[{ name: 'increment', label: 'Move down' }, { name: 'decrement', label: 'Move up' }]}
      onAccessibilityAction={({ nativeEvent }) => onCommit(index, Math.max(0, Math.min(maximum, index + (nativeEvent.actionName === 'increment' ? 1 : -1))))}
      style={styles.handle}>
      <SymbolView name="line.3.horizontal" size={21} tintColor={colors.secondaryText} />
    </Animated.View>
  </GestureDetector>;
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  cell: { shadowColor: '#000000', shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  handle: { width: 44, height: '100%', minHeight: 60, alignItems: 'center', justifyContent: 'center' },
});
