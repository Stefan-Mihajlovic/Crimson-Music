/* global jest, test, expect, afterEach */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { cancelAnimation } from 'react-native-reanimated';
import DraggablePlayerSurface from '../src/components/draggable-player-surface';

let mockNativeInitialStyles = false;
jest.mock('../src/app/player', () => ({ getPlayerArtworkLayout: () => ({ x: 20, y: 150, size: 350 }), PlayerContent: 'FullPlayer' }));
jest.mock('../src/components/frosted-surface', () => 'FrostedSurface');
jest.mock('../src/components/artwork-image', () => 'Artwork');
jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'Symbol' }));
jest.mock('../src/components/bouncy-pressable', () => 'Control');
jest.mock('../src/components/song-swipe-pager', () => ({ SwipeableArtwork: 'ArtworkPager', SwipeableSongCopy: 'SongCopy' }));
jest.mock('../src/components/native-player-accessory', () => ({ AccessoryPlayerContents: 'MiniContents' }));
jest.mock('../src/components/player-artwork-background', () => 'PlayerBackground');
jest.mock('../src/hooks/use-folding-feature', () => ({ useFoldingFeature: () => null }));
jest.mock('../src/services/adaptive-layout', () => ({ playerPanes: () => ({ mode: 'compact' }) }));
jest.mock('../src/providers/player-provider', () => ({
  usePlayer: () => ({ currentSong: { id: 'one', title: 'Song' }, isLiked: false, toggleLike: jest.fn(), togglePlay: jest.fn() }),
  usePlayerStatus: () => ({ duration: 60, currentTime: 0, playing: false }),
}));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { text: '#fff' }, isDark: true, reduceMotion: false, performanceMode: false }) }));
jest.mock('expo-glass-effect', () => ({ GlassView: 'Glass', isGlassEffectAPIAvailable: () => true, isLiquidGlassAvailable: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 62, bottom: 34, left: 0, right: 0 }) }));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn, ...args) => fn(...args) }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: 'AnimatedView', createAnimatedComponent: (component) => component }, cancelAnimation: jest.fn(),
  useSharedValue: (initial) => { const value = require('react').useRef({ value: initial }); value.current.get = () => value.current.value; value.current.set = (next) => { value.current.value = next; }; return value.current; },
  useDerivedValue: (fn) => ({ value: fn() }),
  useAnimatedStyle: (fn) => {
    const initial = require('react').useRef(null);
    if (initial.current === null) initial.current = fn();
    return mockNativeInitialStyles ? initial.current : fn();
  }, withTiming: (target) => target,
  Easing: { out: (fn) => fn, cubic: jest.fn() }, Extrapolation: { CLAMP: 'clamp' },
  interpolate: (value, input, output) => {
    const i = Math.max(0, input.findIndex((point) => point >= value) - 1);
    const t = Math.max(0, Math.min(1, (value - input[i]) / (input[i + 1] - input[i])));
    return output[i] + (output[i + 1] - output[i]) * t;
  },
}));
jest.mock('react-native-gesture-handler', () => {
  const makeGesture = () => {
    const gesture = { handlers: {} };
    for (const name of ['activeOffsetY', 'failOffsetX', 'maxDistance', 'onTouchesDown', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
      gesture[name] = (value) => { gesture.handlers[name] = value; return gesture; };
    }
    return gesture;
  };
  return { GestureDetector: 'GestureDetector', Gesture: {
    Pan: makeGesture, Tap: makeGesture, Exclusive: (...gestures) => ({ gestures }),
  } };
});

let root;
afterEach(async () => { if (root) await act(async () => root.unmount()); mockNativeInitialStyles = false; });

test.each([false, true])('iPhone opening morph has one growing glass surface (inline: %s)', async (inline) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const frame = { x: inline ? 62 : 20, y: 740, width: inline ? 260 : 362, height: inline ? 36 : 52, inline };
  const props = { collapsedTop: frame.y, height: 874, nativeAccessory: true, nativeFrame: frame,
    position: { value: frame.y - 8 }, onBeginExpand: jest.fn(), onExpand: jest.fn(), onCollapse: jest.fn() };
  await act(async () => { root = create(<DraggablePlayerSurface {...props} expanded />); });
  expect(root.root.findAllByType('Glass')).toHaveLength(1);
  expect(root.root.findAllByType('MiniContents')).toHaveLength(2);
  const glassBounds = root.root.findByType('Glass').parent;
  expect(glassBounds.findAllByType('MiniContents')).toHaveLength(2);
  expect(glassBounds.findAllByType('FullPlayer')).toHaveLength(1);
  await act(async () => root.update(<DraggablePlayerSurface {...props} expanded={false} />));
  // At rest, only UIKit's accessory owns the player. No duplicate overlay.
  expect(root.toJSON()).toBeNull();
});


test('each native opening attaches with its current frame, never a cached wide or fullscreen style', async () => {
  // Native AnimatedView attaches with useAnimatedStyle.initial before the UI
  // mapper updates it. Model that first-frame behavior rather than recomputing
  // every mocked style during render (which hides the production flash).
  mockNativeInitialStyles = true;
  const position = { value: 740 };
  const props = { collapsedTop: 740, height: 874, nativeAccessory: true, nativeFrame: null,
    position, onBeginExpand: jest.fn(), onExpand: jest.fn(), onCollapse: jest.fn(), expanded: false };
  await act(async () => { root = create(<DraggablePlayerSurface {...props} />); });
  const frames = [
    { x: 92, y: 802, width: 218, height: 48, inline: true },
    { x: 21, y: 735, width: 360, height: 48, inline: false },
    { x: 92, y: 802, width: 218, height: 48, inline: true },
  ];
  for (const frame of frames) {
    position.value = frame.y;
    await act(async () => root.update(<DraggablePlayerSurface {...props} nativeFrame={frame} collapsedTop={frame.y} expanded />));
    const clip = root.root.findByType('Glass').parent;
    const bounds = StyleSheet.flatten(clip.props.style);
    expect(bounds.width).toBe(frame.width);
    expect(bounds.left).toBe(frame.x);
    expect(bounds.height).toBe(frame.height);
    expect(StyleSheet.flatten(clip.parent.props.style).transform[0].translateY).toBe(frame.y);
    const visible = root.root.findAllByType('MiniContents').filter((view) => StyleSheet.flatten(view.parent.props.style).opacity === 1);
    expect(visible).toHaveLength(1);
    expect(visible[0].props.inline).toBe(frame.inline);
    position.value = 0;
    await act(async () => root.update(<DraggablePlayerSurface {...props} nativeFrame={frame} collapsedTop={frame.y} expanded />));
    await act(async () => root.update(<DraggablePlayerSurface {...props} nativeFrame={frame} collapsedTop={frame.y} />));
    expect(root.toJSON()).toBeNull();
  }
});

test('native source is released only after both replacement layout and artwork are displayed', async () => {
  const onSurfaceReady = jest.fn();
  const frame = { x: 92, y: 802, width: 218, height: 48, inline: true };
  await act(async () => {
    root = create(<DraggablePlayerSurface expanded nativeAccessory nativeFrame={frame}
      collapsedTop={802} height={874} position={{ value: 802 }}
      onBeginExpand={jest.fn()} onExpand={jest.fn()} onCollapse={jest.fn()} onSurfaceReady={onSurfaceReady} />);
  });
  expect(onSurfaceReady).not.toHaveBeenCalled();
  const surface = root.root.findAllByType('AnimatedView').find((view) => view.props.onLayout);
  await act(async () => surface.props.onLayout());
  expect(onSurfaceReady).not.toHaveBeenCalled();
  const artwork = root.root.findAllByType('Artwork').find((view) => view.props.onDisplay);
  await act(async () => artwork.props.onDisplay());
  expect(onSurfaceReady).toHaveBeenCalledTimes(1);
});

test('pressed native content retains its presentation scale through the handoff', async () => {
  const frame = { x: 84, y: 800, width: 234, height: 52, contentWidth: 218, contentHeight: 48, inline: true };
  await act(async () => {
    root = create(<DraggablePlayerSurface expanded nativeAccessory nativeFrame={frame}
      collapsedTop={800} height={874} position={{ value: 800 }}
      onBeginExpand={jest.fn()} onExpand={jest.fn()} onCollapse={jest.fn()} />);
  });
  const content = StyleSheet.flatten(root.root.findAllByType('MiniContents')[0].parent.parent.props.style);
  expect(content.width).toBe(218);
  expect(content.height).toBe(48);
  expect(content.transform).toEqual([{ scaleX: 234 / 218 }, { scaleY: 52 / 48 }]);
});

test('closing morph settles into the unpressed native frame before handing ownership back', async () => {
  const rest = { x: 92, y: 802, width: 218, height: 48 };
  const frame = { x: 84, y: 800, width: 234, height: 52, contentWidth: 218, contentHeight: 48, inline: true, restingFrame: rest };
  const returning = { value: 0 };
  const props = { expanded: true, nativeAccessory: true, nativeFrame: frame,
    collapsedTop: 800, height: 874, position: { value: 800 }, returnProgress: returning,
    onBeginExpand: jest.fn(), onExpand: jest.fn(), onCollapse: jest.fn() };
  await act(async () => { root = create(<DraggablePlayerSurface {...props} />); });
  const bounds = () => StyleSheet.flatten(root.root.findByType('Glass').parent.props.style);
  expect(bounds().width).toBe(234);
  returning.value = 0.5;
  await act(async () => root.update(<DraggablePlayerSurface {...props} />));
  expect(bounds().width).toBe(226);
  returning.value = 1;
  await act(async () => root.update(<DraggablePlayerSurface {...props} />));
  expect(bounds().width).toBe(rest.width);
  expect(bounds().height).toBe(rest.height);
  expect(bounds().left).toBe(rest.x);
  expect(StyleSheet.flatten(root.root.findByType('Glass').parent.parent.props.style).transform[0].translateY).toBe(rest.y);
  const copy = StyleSheet.flatten(root.root.findAllByType('MiniContents')[0].parent.parent.props.style);
  expect(copy.transform).toEqual([{ scaleX: 1 }, { scaleY: 1 }]);
});

test('settling overshoot is bounded and never exposes a gap around fullscreen glass', async () => {
  const frame = { x: 92, y: 802, width: 218, height: 48, inline: true };
  const position = { value: 802 };
  const props = { expanded: true, nativeAccessory: true, nativeFrame: frame,
    collapsedTop: 802, height: 874, position,
    onBeginExpand: jest.fn(), onExpand: jest.fn(), onCollapse: jest.fn() };
  await act(async () => { root = create(<DraggablePlayerSurface {...props} />); });
  for (const value of [-500, -14, 0, 802, 814, 1302]) {
    position.value = value;
    await act(async () => root.update(<DraggablePlayerSurface {...props} />));
    const clip = root.root.findByType('Glass').parent;
    const y = StyleSheet.flatten(clip.parent.props.style).transform[0].translateY;
    if (value <= 0) {
      expect(y).toBe(0);
      expect(StyleSheet.flatten(clip.props.style).height).toBe(874);
      const bodyY = root.root.findByType('FullPlayer').props.bodyAnimatedStyle.transform[0].translateY;
      expect(bodyY).toBeGreaterThan(-14);
      expect(bodyY).toBeLessThanOrEqual(0);
    } else {
      expect(y).toBeGreaterThanOrEqual(802);
      expect(y).toBeLessThan(814);
      expect(StyleSheet.flatten(clip.props.style).width).toBe(218);
    }
  }
});


test('a settling native capsule accepts taps and reversible drags before reaching rest', async () => {
  const frame = { x: 92, y: 802, width: 218, height: 48, inline: true };
  const position = { value: 790 };
  const returning = { value: 0.9 };
  const onExpand = jest.fn();
  const onCollapse = jest.fn();
  const props = { expanded: true, nativeAccessory: true, nativeFrame: frame,
    collapsedTop: 802, height: 874, position, returnProgress: returning,
    onBeginExpand: jest.fn(), onExpand, onCollapse };
  await act(async () => { root = create(<DraggablePlayerSurface {...props} />); });
  const [pan, tap] = root.root.findByType('GestureDetector').props.gesture.gestures;
  const touch = { absoluteX: 150, absoluteY: 810, x: 150, y: 810 };
  const manager = { fail: jest.fn() };
  await act(async () => {
    pan.handlers.onTouchesDown({ allTouches: [touch] }, manager);
    tap.handlers.onTouchesDown({ allTouches: [touch] }, manager);
  });
  // Touch-down itself must pause settling, before crossing any pan threshold.
  expect(cancelAnimation).toHaveBeenCalledWith(position);
  expect(cancelAnimation).toHaveBeenCalledWith(returning);
  expect(props.onBeginExpand).toHaveBeenCalledTimes(1);
  await act(async () => {
    tap.handlers.onEnd({}, true);
  });
  expect(manager.fail).not.toHaveBeenCalled();
  expect(onExpand).toHaveBeenCalledTimes(1);
  await act(async () => {
    pan.handlers.onTouchesDown({ allTouches: [touch] }, manager);
    pan.handlers.onStart();
    pan.handlers.onUpdate({ translationY: -45 });
    pan.handlers.onEnd({ translationY: -45, velocityY: -180 });
  });
  expect(manager.fail).not.toHaveBeenCalled();
  expect(cancelAnimation).toHaveBeenCalledWith(position);
  expect(cancelAnimation).toHaveBeenCalledWith(returning);
  expect(props.onBeginExpand).toHaveBeenCalledTimes(2);
  expect(position.value).toBe(745);
  expect(onExpand).toHaveBeenCalledTimes(2);
  expect(onCollapse).not.toHaveBeenCalled();
  await act(async () => {
    pan.handlers.onTouchesDown({ allTouches: [touch] }, manager);
    tap.handlers.onFinalize({}, false);
  });
  expect(onCollapse).toHaveBeenCalledTimes(1);
});

test('fullscreen closes with a short pull or light flick, while controls and tiny movement stay protected', async () => {
  const position = { value: 0 };
  const onExpand = jest.fn();
  const onCollapse = jest.fn();
  const props = { expanded: true, nativeAccessory: true,
    nativeFrame: { x: 92, y: 802, width: 218, height: 48, inline: true },
    collapsedTop: 802, height: 874, position,
    onBeginExpand: jest.fn(), onExpand, onCollapse };
  await act(async () => { root = create(<DraggablePlayerSurface {...props} />); });
  const [pan, tap] = root.root.findByType('GestureDetector').props.gesture.gestures;
  const manager = { fail: jest.fn() };
  await act(async () => {
    pan.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 700 }] }, manager);
  });
  expect(manager.fail).toHaveBeenCalledTimes(1);
  await act(async () => {
    tap.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 200 }] }, manager);
  });
  expect(manager.fail).toHaveBeenCalledTimes(2);
  for (const [translationY, velocityY, shouldClose] of [[85, 0, true], [25, 300, true], [6, 300, false], [25, 0, false]]) {
    position.value = 0;
    onCollapse.mockClear(); onExpand.mockClear();
    await act(async () => {
      pan.handlers.onStart();
      pan.handlers.onUpdate({ translationY });
      pan.handlers.onEnd({ translationY, velocityY });
    });
    expect(onCollapse).toHaveBeenCalledTimes(shouldClose ? 1 : 0);
    expect(onExpand).toHaveBeenCalledTimes(shouldClose ? 0 : 1);
  }
});

test.each([false, true])('closing follows live destination bounds and contents (opening inline: %s)', async (inline) => {
  const regular = { x: 20, y: 740, width: 362, height: 48, inline: 0 };
  const small = { x: 92, y: 802, width: 218, height: 48, inline: 1 };
  const initial = inline ? small : regular;
  const target = inline ? regular : small;
  const returnFrame = { value: initial };
  const props = { expanded: true, nativeAccessory: true, nativeFrame: { ...initial, inline },
    collapsedTop: initial.y, height: 874, position: { value: initial.y }, returnProgress: { value: 1 }, returnFrame,
    onBeginExpand: jest.fn(), onExpand: jest.fn(), onCollapse: jest.fn() };
  await act(async () => { root = create(<DraggablePlayerSurface {...props} />); });
  for (const progress of [0.25, 0.5, 0.75, 1]) {
    returnFrame.value = Object.fromEntries(Object.keys(initial).map(key => [key, initial[key] + (target[key] - initial[key]) * progress]));
    await act(async () => root.update(<DraggablePlayerSurface {...props} />));
    const clip = root.root.findByType('Glass').parent;
    const bounds = StyleSheet.flatten(clip.props.style);
    expect(bounds.width).toBeCloseTo(returnFrame.value.width);
    expect(bounds.left).toBeCloseTo(returnFrame.value.x);
    expect(StyleSheet.flatten(clip.parent.props.style).transform[0].translateY).toBeCloseTo(returnFrame.value.y);
  }
  const visibleCopy = root.root.findAllByType('MiniContents').filter(view => StyleSheet.flatten(view.parent.props.style).opacity === 1);
  expect(visibleCopy).toHaveLength(1);
  expect(visibleCopy[0].props.inline).toBe(!inline);
  expect(root.root.findAllByType('Glass')).toHaveLength(1);
});
