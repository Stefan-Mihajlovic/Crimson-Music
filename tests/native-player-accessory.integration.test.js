import React from 'react';
import { act, create } from 'react-test-renderer';
import { NativeModules, Platform } from 'react-native';
import { measure, withSpring, withTiming } from 'react-native-reanimated';
import AppTabs from '../src/components/app-tabs';
import { AccessoryPlayerContents } from '../src/components/native-player-accessory';

const mockReactions = new Set();
const mockReactionState = { running: false };
const mockSong = { id: 'one', title: 'Current song', creator: 'Artist', image: '' };
const mockPlayer = { currentSong: mockSong, isLiked: false, toggleLike: jest.fn(), togglePlay: jest.fn() };
const mockStatus = { playing: false, isBuffering: false };
const mockSettings = { colors: { background: '#111', text: '#fff', secondaryText: '#aaa', accent: '#965cff' }, isDark: true, theme: 'Dark', performanceMode: false, reduceMotion: false };
jest.mock('../src/providers/player-provider', () => ({ usePlayer: () => mockPlayer, usePlayerStatus: () => mockStatus }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => mockSettings }));
jest.mock('expo-router', () => ({ useSegments: () => ['(app)', '(home)'], useFocusEffect: jest.fn() }));
jest.mock('expo-router/unstable-native-tabs', () => {
  const React = require('react');
  const NativeTabs = ({ children, ...props }) => React.createElement('NativeTabs', props, children);
  NativeTabs.Trigger = ({ children, ...props }) => React.createElement('TabTrigger', props, children);
  NativeTabs.Trigger.Label = () => null;
  NativeTabs.Trigger.Icon = () => null;
  NativeTabs.BottomAccessory = ({ children }) => React.createElement('BottomAccessory', {}, children);
  NativeTabs.BottomAccessory.usePlacement = () => 'regular';
  return { NativeTabs };
});
jest.mock('../src/components/frosted-surface', () => ({ FrostedLayer: ({ children, background }) => <>{background}{children}</> }));
jest.mock('../src/components/draggable-player-surface', () => function MockSurface(props) {
  const React = require('react');
  React.useEffect(() => { if (props.expanded) void props.onSurfaceReady?.(); }, [props.expanded, props.onSurfaceReady]);
  return React.createElement('PlayerSurface', props);
});
jest.mock('../src/components/performance-tabs', () => 'PerformanceTabs');
jest.mock('../src/components/artwork-image', () => 'Artwork');
jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'Symbol' }));
jest.mock('../src/components/song-swipe-pager', () => ({ SwipeableSongCopy: 'SongCopy' }));
jest.mock('../src/components/bouncy-pressable', () => 'Control');
jest.mock('../src/hooks/use-account-tab-icon', () => ({ useAccountTabIcon: () => 1 }));
jest.mock('../src/services/haptics', () => ({ selectionHaptic: jest.fn() }));
jest.mock('../src/services/navigation-events', () => ({ requestSearchFocus: jest.fn(), subscribeToPlayerCollapse: () => () => {} }));
jest.mock('../src/services/widget-navigation', () => ({ subscribeToWidgetPlayerPresentation: () => () => {} }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 62, bottom: 34 }) }));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn, ...args) => fn(...args), scheduleOnUI: (fn, ...args) => fn(...args) }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: 'AnimatedView' }, cancelAnimation: jest.fn(), measure: jest.fn(),
  useAnimatedRef: () => require('react').useRef(null),
  useSharedValue: (initial) => {
    const React = require('react');
    const ref = React.useRef(null);
    if (!ref.current) {
      let value = initial;
      ref.current = { get value() { return value; }, set value(next) {
        value = next;
        if (!mockReactionState.running) {
          mockReactionState.running = true;
          for (const reaction of mockReactions) reaction();
          mockReactionState.running = false;
        }
      } };
    }
    return ref.current;
  },
  useAnimatedReaction: (prepare, react) => {
    const React = require('react');
    const latest = React.useRef({ prepare, react }); latest.current = { prepare, react };
    React.useEffect(() => { const run = () => latest.current.react(latest.current.prepare()); mockReactions.add(run); return () => mockReactions.delete(run); }, []);
  },
  withTiming: jest.fn((target, _config, callback) => { callback?.(true); return target; }),
  withSpring: jest.fn((target, _config, callback) => { callback?.(true); return target; }),
}));
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: 'GestureRoot', GestureDetector: 'GestureDetector',
  Gesture: { Pan: () => {
    const gesture = {};
    gesture.handlers = {};
    for (const name of ['enabled', 'hitSlop', 'manualActivation', 'cancelsTouchesInView', 'onTouchesDown', 'onTouchesMove', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) gesture[name] = (value) => { gesture.handlers[name] = value; return gesture; };
    return gesture;
  } },
}));

let root;
const originalVersion = Object.getOwnPropertyDescriptor(Platform, 'Version');
const originalPad = Object.getOwnPropertyDescriptor(Platform, 'isPad');
function device(os = 'ios', version = '27.2', isPad = false) {
  Platform.OS = os;
  Object.defineProperty(Platform, 'Version', { configurable: true, value: version });
  Object.defineProperty(Platform, 'isPad', { configurable: true, value: isPad });
}
const mount = async (node = <AppTabs />) => act(async () => { root = create(node); });
const surface = () => root.root.findByType('PlayerSurface').props;
const tabs = () => root.root.findByType('NativeTabs').props;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  device();
  mockPlayer.currentSong = mockSong;
  mockSettings.performanceMode = false;
  mockSettings.reduceMotion = false;
  mockStatus.playing = false;
  mockStatus.isBuffering = false;
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
  delete NativeModules.CrimsonRemoteControls;
  Platform.OS = 'ios';
  if (originalVersion) Object.defineProperty(Platform, 'Version', originalVersion);
  if (originalPad) Object.defineProperty(Platform, 'isPad', originalPad);
});

test('iPhone uses the native accessory and opens from its measured inline frame', async () => {
  await mount();
  expect(tabs().minimizeBehavior).toBe('onScrollDown');
  expect(root.root.findAllByType('TabTrigger').map((tab) => tab.props.name)).toEqual(['(home)', '(library)', '(account)', '(search)']);
  const frame = { x: 92, y: 802, width: 218, height: 48, inline: true };
  const gesture = root.root.findByType('GestureDetector').props.gesture;
  measure.mockReturnValue({ pageX: frame.x, pageY: frame.y, width: frame.width, height: frame.height });
  await act(async () => {
    gesture.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 820 }] }, { fail: jest.fn() });
    gesture.handlers.onStart({ translationY: -8 });
  });
  expect(surface().expanded).toBe(true);
  expect(surface().nativeFrame).toEqual(frame);
  expect(surface().position.value).toBe(802);
  expect(tabs().unstable_nativeProps.ios.bottomAccessoryHidden).toBe(true);
  await act(async () => surface().onCollapse());
  expect(withSpring.mock.calls.at(-1)[0]).toBe(frame.y);
  expect(surface().expanded).toBe(false);
  expect(tabs().unstable_nativeProps.ios.bottomAccessoryHidden).toBe(false);
});

test.each([
  ['ios', '18.6', false, false],
  ['ios', '27.2', true, false],
  ['android', 36, false, false],
  ['ios', '27.2', false, true],
])('preserves the existing layout on %s %s (iPad %s, Performance Mode %s)', async (os, version, pad, performance) => {
  device(os, version, pad);
  mockSettings.performanceMode = performance;
  await mount();
  expect(tabs().minimizeBehavior).toBe('never');
  expect(root.root.findAllByType('BottomAccessory')).toHaveLength(0);
  expect(surface().nativeAccessory).toBe(false);
  expect(surface().nativeFrame).toBeNull();
  expect(tabs().unstable_nativeProps.ios.bottomAccessoryHidden).toBe(false);
  expect(root.root.findAllByType('TabTrigger').map((tab) => tab.props.name)).toEqual(['(home)', '(search)', '(library)', '(account)']);
});

test('the host keeps tracking after the native accessory is hidden and restores it on cancellation', async () => {
  await mount();
  const gesture = root.root.findByType('GestureDetector').props.gesture;
  const frame = { x: 20, y: 740, width: 362, height: 52, inline: false };
  measure.mockReturnValue({ pageX: frame.x, pageY: frame.y, width: frame.width, height: frame.height });
  await act(async () => {
    gesture.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 760 }] }, { fail: jest.fn() });
    gesture.handlers.onStart({ translationY: -8 });
  });
  expect(tabs().unstable_nativeProps.ios.bottomAccessoryHidden).toBe(true);
  expect(root.root.findByType('GestureDetector').props.gesture).toBe(gesture);
  await act(async () => gesture.handlers.onUpdate({ translationY: -90 }));
  expect(surface().position.value).toBe(658); // movement starts at the committed -8pt handoff
  await act(async () => gesture.handlers.onFinalize());
  expect(surface().position.value).toBe(frame.y);
  expect(surface().expanded).toBe(false);
  expect(tabs().unstable_nativeProps.ios.bottomAccessoryHidden).toBe(false);
});

test('dragging the minimized accessory preserves inline controls even with a 48pt native host', async () => {
  await mount();
  const gesture = root.root.findByType('GestureDetector').props.gesture;
  measure.mockReturnValue({ pageX: 92, pageY: 802, width: 218, height: 48 });
  await act(async () => {
    gesture.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 820 }] }, { fail: jest.fn() });
    gesture.handlers.onStart({ translationY: -8 });
  });
  expect(surface().nativeFrame.inline).toBe(true);
  expect(surface().nativeFrame.height).toBe(48);
});

test('content touches and horizontal swipes never activate the player pan', async () => {
  await mount();
  const gesture = root.root.findByType('GestureDetector').props.gesture;
  measure.mockReturnValue({ pageX: 20, pageY: 740, width: 362, height: 48 });
  const manager = { fail: jest.fn(), activate: jest.fn() };
  gesture.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 400 }] }, manager);
  gesture.handlers.onTouchesMove({ allTouches: [{ absoluteX: 150, absoluteY: 300 }] }, manager);
  expect(manager.fail).toHaveBeenCalled();
  expect(manager.activate).not.toHaveBeenCalled();
  manager.fail.mockClear();
  gesture.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 760 }] }, manager);
  gesture.handlers.onTouchesMove({ allTouches: [{ absoluteX: 175, absoluteY: 759 }] }, manager);
  expect(manager.fail).toHaveBeenCalledTimes(1);
  expect(manager.activate).not.toHaveBeenCalled();
  gesture.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 760 }] }, manager);
  gesture.handlers.onTouchesMove({ allTouches: [{ absoluteX: 151, absoluteY: 749 }] }, manager);
  expect(manager.activate).toHaveBeenCalledTimes(1);
});

test('a hidden regular placement cannot supply the compact opening geometry', async () => {
  NativeModules.CrimsonRemoteControls = { beginPlayerTransition: async () => ({
    x: 92, y: 802, width: 218, height: 48, inline: true,
    presentation: { x: 91, y: 801, width: 220, height: 50 },
  }) };
  await mount();
  const gesture = root.root.findByType('GestureDetector').props.gesture;
  measure.mockReturnValueOnce({ pageX: 21, pageY: 735, width: 360, height: 48 })
    .mockReturnValueOnce({ pageX: 92, pageY: 800, width: 220, height: 48 });
  const manager = { fail: jest.fn() };
  await act(async () => {
    gesture.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 820 }] }, manager);
    gesture.handlers.onStart({ translationY: -8 });
  });
  expect(manager.fail).not.toHaveBeenCalled();
  expect(surface().nativeFrame).toMatchObject({ x: 92, y: 802, width: 218, height: 48, inline: true });
  expect(surface().position.value).toBe(802);
  await act(async () => gesture.handlers.onUpdate({ translationY: -18 }));
  expect(surface().position.value).toBe(792);
  await act(async () => gesture.handlers.onFinalize());
  expect(surface().expanded).toBe(false);
});

test('Reduce Motion keeps the native accessory stationary; no song leaves no empty accessory', async () => {
  mockSettings.reduceMotion = true;
  await mount();
  expect(tabs().minimizeBehavior).toBe('never');
  expect(root.root.findAllByType('BottomAccessory')).toHaveLength(1);
  withSpring.mockClear();
  await act(async () => surface().onExpand(-1800));
  await act(async () => surface().onCollapse(1800));
  expect(withSpring).not.toHaveBeenCalled();
  expect(surface().expanded).toBe(false);
  mockPlayer.currentSong = null;
  await act(async () => root.update(<AppTabs />));
  expect(root.root.findAllByType('BottomAccessory')).toHaveLength(0);
});

test('regular and inline controls share playback state and preserve loading cancellation', async () => {
  const contents = () => <><AccessoryPlayerContents inline={false} onExpand={jest.fn()} /><AccessoryPlayerContents inline onExpand={jest.fn()} /></>;
  await mount(contents());
  let controls = root.root.findAllByType('Control');
  expect(controls.map((node) => node.props.accessibilityLabel)).toEqual(['Add to favorites', 'Play', 'Play']);
  await act(async () => controls[2].props.onPress());
  expect(mockPlayer.togglePlay).toHaveBeenCalledTimes(1);
  mockStatus.playing = true;
  await act(async () => root.update(contents()));
  expect(root.root.findAllByType('Control').slice(1).map((node) => node.props.accessibilityLabel)).toEqual(['Pause', 'Pause']);
  mockStatus.isBuffering = true;
  await act(async () => root.update(contents()));
  controls = root.root.findAllByType('Control');
  expect(controls[2].props.accessibilityLabel).toBe('Cancel loading');
  await act(async () => controls[2].props.onPress());
  expect(mockPlayer.togglePlay).toHaveBeenCalledTimes(2);
});


test('movement during native measurement cannot resize the first replacement frame', async () => {
  let resolveGeometry;
  NativeModules.CrimsonRemoteControls = { beginPlayerTransition: () => new Promise((resolve) => { resolveGeometry = resolve; }) };
  await mount();
  const gesture = root.root.findByType('GestureDetector').props.gesture;
  measure.mockReturnValue({ pageX: 20, pageY: 740, width: 362, height: 48 });
  await act(async () => {
    gesture.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 760 }] }, { fail: jest.fn() });
    gesture.handlers.onStart({ translationY: -8 });
    gesture.handlers.onUpdate({ translationY: -120 });
  });
  expect(surface().position.value).toBe(740);
  await act(async () => resolveGeometry({ inline: false, x: 20, y: 740, width: 362, height: 48 }));
  expect(surface().position.value).toBe(628); // mounting travel is recovered (timing completes immediately in this mock)
  expect(surface().nativeFrame).toMatchObject({ y: 740, width: 362 });
  await act(async () => gesture.handlers.onUpdate({ translationY: -126 }));
  expect(surface().position.value).toBe(622);
  await act(async () => gesture.handlers.onFinalize());
  expect(surface().expanded).toBe(false);
});

test('a quick release waits for native glass geometry before settling the player', async () => {
  let resolveGeometry;
  NativeModules.CrimsonRemoteControls = { beginPlayerTransition: () => new Promise((resolve) => { resolveGeometry = resolve; }) };
  await mount();
  const gesture = root.root.findByType('GestureDetector').props.gesture;
  measure.mockReturnValue({ pageX: 20, pageY: 740, width: 362, height: 48 });
  await act(async () => {
    gesture.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 760 }] }, { fail: jest.fn() });
    gesture.handlers.onStart({ translationY: -8 });
    gesture.handlers.onEnd({ velocityY: -4000 });
  });
  expect(tabs().unstable_nativeProps.ios.bottomAccessoryHidden).toBe(false);
  const frame = { x: 14, y: 735, width: 374, height: 56, inline: false };
  await act(async () => resolveGeometry(frame));
  expect(surface().nativeFrame).toMatchObject(frame);
  expect(surface().nativeFrame.y).toBe(735);
  expect(surface().position.value).toBe(0);
  expect(tabs().unstable_nativeProps.ios.bottomAccessoryHidden).toBe(true);
});

test('the minimized accessory uses the two-line song pager with swiping enabled', async () => {
  await mount(<AccessoryPlayerContents inline onExpand={jest.fn()} />);
  const pager = root.root.findByType('SongCopy');
  expect(pager.props.compact).toBe(true);
  expect(pager.props.fadeOverflow).toBe(true);
  expect(pager.props.enabled).toBe(true);
});

test('a release cannot start moving the new surface before native handoff completes', async () => {
  let finish;
  NativeModules.CrimsonRemoteControls = {
    beginPlayerTransition: jest.fn(async () => ({ x: 92, y: 802, width: 218, height: 48, inline: true, handoffToken: 'one' })),
    finishPlayerTransition: jest.fn(() => new Promise((resolve) => { finish = resolve; })),
  };
  await mount();
  const gesture = root.root.findByType('GestureDetector').props.gesture;
  measure.mockReturnValue({ pageX: 92, pageY: 802, width: 218, height: 48 });
  await act(async () => {
    gesture.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 820 }] }, { fail: jest.fn() });
    gesture.handlers.onStart({ translationY: -8 });
  });
  expect(NativeModules.CrimsonRemoteControls.finishPlayerTransition).toHaveBeenCalledWith('one');
  await act(async () => {
    gesture.handlers.onUpdate({ translationY: -150 });
    gesture.handlers.onEnd({ velocityY: -2000 });
  });
  expect(surface().position.value).toBe(802);
  await act(async () => finish());
  expect(surface().position.value).toBe(0);
});


test('closing waits for the unpressed geometry and cannot unmount an interrupted reopening', async () => {
  await mount();
  const gesture = root.root.findByType('GestureDetector').props.gesture;
  measure.mockReturnValue({ pageX: 92, pageY: 802, width: 218, height: 48 });
  await act(async () => {
    gesture.handlers.onTouchesDown({ allTouches: [{ absoluteX: 150, absoluteY: 820 }] }, { fail: jest.fn() });
    gesture.handlers.onStart({ translationY: -3 });
  });
  await act(async () => gesture.handlers.onEnd({ velocityY: -2000 }));
  let finishBounds;
  withTiming.mockImplementationOnce((target, config, callback) => {
    expect(config.duration).toBe(280);
    finishBounds = callback;
    return target;
  });
  await act(async () => surface().onCollapse());
  expect(surface().expanded).toBe(true);
  await act(async () => surface().onExpand());
  await act(async () => finishBounds(true));
  expect(surface().expanded).toBe(true);
  expect(surface().position.value).toBe(0);
});

test('opening preserves its original curve; closing follows speed and waits for the rebound', async () => {
  await mount();
  await act(async () => surface().onExpand(-150));
  const slow = withSpring.mock.calls.at(-1)[1];
  await act(async () => surface().onExpand(-1600));
  const fast = withSpring.mock.calls.at(-1)[1];
  expect(slow).toMatchObject({ damping: 26.5, stiffness: 190, mass: 0.9, overshootClamping: true });
  expect(fast.damping).toBe(slow.damping);
  await act(async () => surface().onCollapse(150));
  const slowClose = withSpring.mock.calls.at(-1)[1];
  await act(async () => surface().onExpand());
  expect(fast.velocity).toBe(-1600);
  let settle;
  withSpring.mockImplementationOnce((target, config, callback) => {
    expect(config.overshootClamping).toBe(false);
    expect(config.velocity).toBe(1800);
    expect(config.damping).toBeLessThan(slowClose.damping);
    settle = callback;
    return target + 8;
  });
  await act(async () => surface().onCollapse(5000));
  expect(surface().expanded).toBe(true);
  expect(tabs().unstable_nativeProps.ios.bottomAccessoryHidden).toBe(true);
  await act(async () => settle(true));
  expect(surface().expanded).toBe(false);
});

test('closing retargets regular to inline during scroll and waits for the new geometry', async () => {
  jest.useFakeTimers();
  const regular = { x: 20, y: 740, width: 362, height: 48, inline: false };
  const inline = { x: 92, y: 802, width: 218, height: 48, inline: true };
  const sample = jest.fn().mockResolvedValue(regular);
  NativeModules.CrimsonRemoteControls = { measurePlayerDestination: sample };
  try {
    await mount();
    await act(async () => surface().onBeginExpand());
    let finishTravel;
    withSpring.mockImplementationOnce((target, _config, done) => { finishTravel = done; return target; });
    await act(async () => surface().onCollapse());
    expect(surface().returnFrame.value).toEqual({ ...regular, inline: 0 });
    let finishDestination;
    withTiming.mockImplementationOnce((target, _config, done) => { finishDestination = done; return target; });
    sample.mockResolvedValue(inline);
    await act(async () => { jest.advanceTimersByTime(50); });
    expect(surface().returnFrame.value).toEqual({ ...inline, inline: 1 });
    await act(async () => finishTravel(true));
    expect(surface().expanded).toBe(true);
    await act(async () => finishDestination(true));
    expect(surface().expanded).toBe(false);
    const count = sample.mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(500); });
    expect(sample).toHaveBeenCalledTimes(count);
  } finally { jest.useRealTimers(); }
});

test('a destination measurement from an interrupted close cannot alter a reopening', async () => {
  let resolveFrame;
  NativeModules.CrimsonRemoteControls = { measurePlayerDestination: jest.fn(() => new Promise(resolve => { resolveFrame = resolve; })) };
  await mount();
  await act(async () => surface().onExpand());
  await act(async () => surface().onCollapse());
  const previous = surface().returnFrame.value;
  await act(async () => surface().onExpand());
  await act(async () => resolveFrame({ x: 92, y: 802, width: 218, height: 48, inline: true }));
  expect(surface().returnFrame.value).toEqual(previous);
  expect(surface().expanded).toBe(true);
  expect(surface().position.value).toBe(0);
});
