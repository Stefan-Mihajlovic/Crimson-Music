const React = require('react');
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;

const mockDispatch = jest.fn();
const mockSearchFocus = jest.fn();
let mockActiveTab = 3;
const mockTabState = {
  key: 'existing-native-tabs',
  index: 3,
  routes: [
    { key: 'home', name: '(home)', state: { index: 1, routes: [{ name: 'index' }, { name: 'artist' }] } },
    { key: 'search', name: '(search)' },
    { key: 'library', name: '(library)' },
    { key: 'account', name: '(account)' },
  ],
};

jest.mock('expo-router', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  useRootNavigationState: () => ({ routes: [{ name: '(app)', state: { ...mockTabState, index: mockActiveTab } }] }),
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-symbols', () => ({ SymbolView: 'SymbolView' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) }));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { ProfilePhoto: '1' } }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { accent: '#a78aff', background: '#111', elevated: '#222', border: '#333', secondaryText: '#aaa' } }) }));
jest.mock('../src/services/navigation-events', () => ({ requestSearchFocus: () => mockSearchFocus() }));

const PerformanceTabs = require('../src/components/performance-tabs').default;

beforeEach(() => { mockActiveTab = 3; });

function tap(tree, name) {
  const button = tree.root.findAllByProps({ accessibilityRole: 'tab' }).find((item) => item.props.accessibilityLabel === name);
  expect(button).toBeDefined();
  act(() => button.props.onPress());
}

test('solid tabs select the existing native navigator without replacing nested detail stacks', () => {
  let tree;
  act(() => { tree = TestRenderer.create(<PerformanceTabs />); });
  tap(tree, 'Home');
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'NAVIGATE', target: 'existing-native-tabs', payload: { name: '(home)' } });
  expect(mockTabState.routes[0].state.routes[1].name).toBe('artist');
  act(() => tree.unmount());
});

test('tapping the selected Account tab is stable, and reselecting Search focuses search', () => {
  let tree;
  act(() => { tree = TestRenderer.create(<PerformanceTabs />); });
  tap(tree, 'Account');
  expect(mockDispatch).not.toHaveBeenCalled();
  mockActiveTab = 1;
  act(() => tree.update(<PerformanceTabs />));
  tap(tree, 'Search');
  expect(mockSearchFocus).toHaveBeenCalledTimes(1);
  expect(mockDispatch).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
