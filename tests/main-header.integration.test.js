/* global jest, beforeEach, test, expect */

const React = require('react');
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
const ReactNative = require('react-native');
const { Platform, StyleSheet, Text, View } = ReactNative;

let mockHeaderOptions;
let mockPerformanceMode = false;
let mockFocused = true;
const mockPush = jest.fn();
const mockOffset = { value: 0 };

jest.mock('expo-router', () => ({
  Stack: { Screen: ({ options }) => { mockHeaderOptions = options; return null; } },
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: () => undefined,
  useIsFocused: () => mockFocused,
}));
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: { Text, View },
    useAnimatedStyle: (createStyle) => createStyle(),
    useAnimatedReaction: (prepare, react) => {
      const next = prepare();
      const previous = React.useRef(null);
      React.useEffect(() => {
        const prior = previous.current;
        previous.current = next;
        react(next, prior);
      }, [next, react]);
    },
  };
});
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: jest.fn((callback, ...args) => callback(...args)),
}));
jest.mock('expo-glass-effect', () => ({
  GlassView: 'ExpoGlassView',
  isGlassEffectAPIAvailable: () => require('react-native').Platform.OS === 'ios',
  isLiquidGlassAvailable: () => require('react-native').Platform.OS === 'ios',
}));
jest.mock('react-native-screens', () => ({ FullWindowOverlay: 'FullWindowOverlay' }));
jest.mock('expo-symbols', () => ({ SymbolView: 'SymbolView' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { uid: 'listener' } }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { text: '#fff', accent: '#a78aff', background: '#111', elevated: '#222', border: '#333' }, isDark: true, reduceMotion: false, performanceMode: mockPerformanceMode }) }));
jest.mock('../src/services/action-sheet', () => ({ useDetailRoutes: () => ({ historyHref: () => '/history', notificationsHref: () => '/notifications' }) }));
jest.mock('../src/services/notifications', () => ({
  subscribeNotificationUnreadCount: () => () => {},
  getNotificationUnreadCount: () => 0,
  loadNotificationsPage: jest.fn(),
}));

const MainNativeHeader = require('../src/components/main-native-header').default;
const { MainCompactHeader, MainCompactTitle } = require('../src/components/main-native-header');
const MainScreenHeader = require('../src/components/main-screen-header').default;
const MainHeaderActions = require('../src/components/main-header-actions').default;
const MainHeaderOverlay = require('../src/components/main-header-overlay').default;
const { MainHeaderSpacer } = require('../src/components/main-header-overlay');
const { PlayerOverlayVisibilityProvider } = require('../src/providers/player-overlay-visibility-provider');

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockOffset.value = 0;
  mockPerformanceMode = false;
  mockFocused = true;
  mockPush.mockClear();
  Platform.OS = 'ios';
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 393, height: 852, scale: 3, fontScale: 1 });
});

function headerClip(tree) {
  return tree.root.findByType('FullWindowOverlay').findAllByType(View)
    .find((view) => StyleSheet.flatten(view.props.style)?.overflow === 'hidden');
}

function layOutHeaderGlass(tree) {
  act(() => {
    tree.root.findAllByType('ExpoGlassView').forEach((glass) => glass.props.onLayout());
  });
}

test('all tab roots retain the real UIKit bar and native soft scroll edge while the compact title fades', () => {
  let tree;
  for (const title of ['Home', 'Search', 'Library', 'Account']) {
    act(() => { tree = TestRenderer.create(<MainNativeHeader title={title} offset={mockOffset} />); });
    expect(mockHeaderOptions.headerLargeTitleEnabled).toBe(false);
    expect(mockHeaderOptions.headerShown).toBe(true);
    expect(mockHeaderOptions.headerTransparent).toBe(true);
    expect(mockHeaderOptions.headerBlurEffect).toBe('none');
    expect(mockHeaderOptions.scrollEdgeEffects.top).toBe('soft');
    expect(mockHeaderOptions.headerRight).toBeUndefined();
    expect(mockHeaderOptions.title).toBe(title);
    expect(mockHeaderOptions.headerTitle().type).toBe(MainCompactTitle);
    mockOffset.value = 80;
    act(() => tree.update(<MainNativeHeader title={title} offset={mockOffset} />));
    expect(mockHeaderOptions.headerShown).toBe(true);
    act(() => tree.unmount());
  }
});

test('compact title continuously fades without changing native material or creating a custom glass surface', () => {
  let tree;
  act(() => { tree = TestRenderer.create(<MainCompactTitle title="Home" offset={mockOffset} />); });
  const opacity = () => StyleSheet.flatten(tree.root.findByType(View).props.style).opacity;
  expect(opacity()).toBe(0);
  mockOffset.value = 50;
  act(() => tree.update(<MainCompactTitle title="Home" offset={mockOffset} />));
  expect(opacity()).toBeCloseTo(0.5);
  mockOffset.value = 80;
  act(() => tree.update(<MainCompactTitle title="Home" offset={mockOffset} />));
  expect(opacity()).toBe(1);
  expect(tree.root.findByType(View).props.pointerEvents).toBe('none');
  act(() => tree.unmount());
});

test('expanded heading keeps History and Notifications together in one row with working actions', () => {
  let tree;
  act(() => { tree = TestRenderer.create(<MainScreenHeader title="Home" offset={mockOffset} trailing={<MainHeaderActions />} />); });
  const row = tree.root.findAllByType(View).find((view) => StyleSheet.flatten(view.props.style)?.minHeight === 80);
  expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row', alignItems: 'center' });
  const title = tree.root.findAllByType(Text).find((text) => text.props.children === 'Home');
  expect(StyleSheet.flatten(title.props.style).opacity).toBe(1);
  const history = tree.root.findAllByProps({ accessibilityLabel: 'Open listening history' })[0];
  const notifications = tree.root.findAllByProps({ accessibilityLabel: 'Open notifications' })[0];
  act(() => history.props.onPress());
  act(() => notifications.props.onPress());
  expect(mockPush.mock.calls).toEqual([['/history'], ['/notifications']]);
  act(() => tree.unmount());
});

test('expanded glass stays mounted and opaque while the row scrolls and only its content fades', () => {
  let tree;
  act(() => { tree = TestRenderer.create(<MainHeaderOverlay title="Home" offset={mockOffset} />); });
  const windowOverlay = tree.root.findByType('FullWindowOverlay');
  expect(windowOverlay.props.unstable_accessibilityContainerViewIsModal).toBe(false);
  expect(headerClip(tree).props.pointerEvents).toBe('box-none');
  expect(StyleSheet.flatten(headerClip(tree).props.style)).toMatchObject({ top: 59, height: 793, overflow: 'hidden' });
  expect(tree.root.findAllByType(MainCompactHeader)).toHaveLength(0);
  const overlay = () => tree.root.findAllByType(View).find((view) => StyleSheet.flatten(view.props.style)?.height === 80);
  expect(StyleSheet.flatten(overlay().props.style)).toMatchObject({ position: 'absolute', top: 0, height: 80, transform: [{ translateY: -0 }] });
  expect(StyleSheet.flatten(overlay().props.style).opacity).toBeUndefined();
  expect(StyleSheet.flatten(headerClip(tree).props.style).opacity).toBeUndefined();
  expect(overlay().props.pointerEvents).toBe('box-none');
  layOutHeaderGlass(tree);
  const originalGlass = tree.root.findAllByType('ExpoGlassView');
  expect(originalGlass).toHaveLength(2);
  expect(originalGlass.every((glass) => glass.props.glassEffectStyle === 'regular')).toBe(true);

  mockOffset.value = 68;
  act(() => tree.update(<MainHeaderOverlay title="Home" offset={mockOffset} />));
  expect(StyleSheet.flatten(overlay().props.style)).toMatchObject({ transform: [{ translateY: -68 }] });
  expect(StyleSheet.flatten(overlay().props.style).opacity).toBeUndefined();
  expect(overlay().props.pointerEvents).toBe('box-none');
  const title = tree.root.findAllByType(Text).find((text) => text.props.children === 'Home');
  expect(StyleSheet.flatten(title.props.style).opacity).toBe(0);
  expect(tree.root.findAllByType('ExpoGlassView')[0]).toBe(originalGlass[0]);
  expect(tree.root.findAllByType('ExpoGlassView').every((glass) => glass.props.glassEffectStyle === 'none')).toBe(true);

  mockOffset.value = 0;
  act(() => tree.update(<MainHeaderOverlay title="Home" offset={mockOffset} />));
  expect(tree.root.findByType('FullWindowOverlay')).toBe(windowOverlay);
  expect(tree.root.findAllByType('ExpoGlassView')[0]).toBe(originalGlass[0]);
  expect(tree.root.findAllByType('ExpoGlassView').every((glass) => glass.props.glassEffectStyle === 'regular')).toBe(true);
  expect(overlay().props.pointerEvents).toBe('box-none');
  act(() => tree.unmount());
  act(() => { tree = TestRenderer.create(<MainHeaderSpacer />); });
  expect(StyleSheet.flatten(tree.root.findByType(View).props.style).height).toBe(80);
  act(() => tree.unmount());
});

test('blur clips the mounted window overlay out of view and accessibility, then restores it on focus', () => {
  let tree;
  act(() => { tree = TestRenderer.create(<MainHeaderOverlay title="Account" offset={mockOffset} />); });
  layOutHeaderGlass(tree);
  const windowOverlay = tree.root.findByType('FullWindowOverlay');
  const originalGlass = tree.root.findAllByType('ExpoGlassView')[0];
  expect(StyleSheet.flatten(headerClip(tree).props.style).height).toBe(793);
  mockFocused = false;
  act(() => tree.update(<MainHeaderOverlay title="Account" offset={mockOffset} />));
  expect(tree.root.findByType('FullWindowOverlay')).toBe(windowOverlay);
  expect(StyleSheet.flatten(headerClip(tree).props.style).height).toBe(0);
  expect(headerClip(tree).props.accessibilityElementsHidden).toBe(true);
  expect(headerClip(tree).props.importantForAccessibility).toBe('no-hide-descendants');
  expect(tree.root.findAllByType('ExpoGlassView')[0]).toBe(originalGlass);
  expect(originalGlass.props.glassEffectStyle).toBe('none');
  mockFocused = true;
  act(() => tree.update(<MainHeaderOverlay title="Account" offset={mockOffset} />));
  expect(StyleSheet.flatten(headerClip(tree).props.style).height).toBe(793);
  expect(headerClip(tree).props.accessibilityElementsHidden).toBe(false);
  expect(headerClip(tree).props.importantForAccessibility).toBe('auto');
  expect(originalGlass.props.glassEffectStyle).toBe('regular');
  act(() => tree.unmount());
});

test('player position progressively clips the header and minimizing restores its action', () => {
  const position = { value: 852 };
  const screen = (visible) => (
    <PlayerOverlayVisibilityProvider visible={visible} position={position}>
      <MainHeaderOverlay title="Home" offset={mockOffset} />
    </PlayerOverlayVisibilityProvider>
  );
  let tree;
  act(() => { tree = TestRenderer.create(screen(false)); });
  const windowOverlay = tree.root.findByType('FullWindowOverlay');
  expect(StyleSheet.flatten(headerClip(tree).props.style).height).toBe(793);
  position.value = 100;
  act(() => tree.update(screen(false)));
  expect(StyleSheet.flatten(headerClip(tree).props.style).height).toBe(41);
  expect(tree.root.findByType('FullWindowOverlay')).toBe(windowOverlay);
  position.value = 0;
  act(() => tree.update(screen(true)));
  expect(StyleSheet.flatten(headerClip(tree).props.style).height).toBe(0);
  expect(headerClip(tree).props.accessibilityElementsHidden).toBe(true);
  expect(headerClip(tree).props.importantForAccessibility).toBe('no-hide-descendants');
  position.value = 852;
  act(() => tree.update(screen(false)));
  expect(StyleSheet.flatten(headerClip(tree).props.style).height).toBe(793);
  expect(headerClip(tree).props.accessibilityElementsHidden).toBe(false);
  const history = tree.root.findAllByProps({ accessibilityLabel: 'Open listening history' })[0];
  act(() => history.props.onPress());
  expect(mockPush).toHaveBeenCalledWith('/history');
  act(() => tree.unmount());
});

test('preview and web headers stay in their own screen instead of creating a window overlay', () => {
  let tree;
  act(() => { tree = TestRenderer.create(<MainHeaderOverlay title="Home" offset={mockOffset} compact={false} />); });
  expect(tree.root.findAllByType('FullWindowOverlay')).toHaveLength(0);
  expect(tree.root.findAllByType(MainScreenHeader)).toHaveLength(1);
  expect(tree.root.findAllByType(MainCompactHeader)).toHaveLength(0);
  Platform.OS = 'web';
  act(() => tree.update(<MainHeaderOverlay title="Home" offset={mockOffset} />));
  expect(tree.root.findAllByType('FullWindowOverlay')).toHaveLength(0);
  expect(tree.root.findAllByType(MainCompactHeader)).toHaveLength(1);
  act(() => tree.unmount());
});

test('Performance Mode hides the UIKit bar and uses a solid compact header', () => {
  mockPerformanceMode = true;
  mockOffset.value = 80;
  let tree;
  act(() => { tree = TestRenderer.create(<><MainNativeHeader title="Account" offset={mockOffset} /><MainHeaderOverlay title="Account" offset={mockOffset} /></>); });
  expect(mockHeaderOptions.headerShown).toBe(false);
  expect(mockHeaderOptions.scrollEdgeEffects.top).toBe('hidden');
  expect(tree.root.findAllByType('ExpoGlassView')).toHaveLength(0);
  const fallback = tree.root.findByType(MainCompactHeader);
  const background = fallback.findAllByType(View)[0];
  expect(StyleSheet.flatten(background.props.style)).toMatchObject({ height: 103, opacity: 1, backgroundColor: '#111' });
  act(() => tree.unmount());
});
