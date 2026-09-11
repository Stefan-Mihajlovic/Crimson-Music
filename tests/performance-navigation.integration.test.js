const React = require('react');
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;

const mockNavigate = jest.fn();
const mockSearchFocus = jest.fn();
let mockSegments = ['(app)', '(account)', 'account'];

jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
  useSegments: () => mockSegments,
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-symbols', () => ({ SymbolView: 'SymbolView' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) }));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { ProfilePhoto: '1' } }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { accent: '#a78aff', background: '#111', elevated: '#222', border: '#333', secondaryText: '#aaa' } }) }));
jest.mock('../src/services/navigation-events', () => ({ requestSearchFocus: () => mockSearchFocus() }));

const PerformanceTabs = require('../src/components/performance-tabs').default;

beforeEach(() => { mockSegments = ['(app)', '(account)', 'account']; });

function tap(tree, name) {
  const button = tree.root.findAllByProps({ accessibilityRole: 'tab' }).find((item) => item.props.accessibilityLabel === name);
  expect(button).toBeDefined();
  act(() => button.props.onPress());
}

test.each([
  ['Home', '/(app)/(home)'],
  ['Search', '/(app)/(search)/search'],
  ['Library', '/(app)/(library)/library'],
  ['Account', '/(app)/(account)/account'],
])('solid %s tab navigates to its route without depending on root navigator state', (label, href) => {
  let tree;
  act(() => { tree = TestRenderer.create(<PerformanceTabs />); });
  tap(tree, label);
  expect(mockNavigate).toHaveBeenCalledWith(href);
  expect(mockSearchFocus).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

test('nested Search stays selected, but only reselecting its root focuses the search field', () => {
  let tree;
  mockSegments = ['(app)', '(search)', 'artist'];
  act(() => { tree = TestRenderer.create(<PerformanceTabs />); });
  const tab = tree.root.findAllByProps({ accessibilityRole: 'tab' }).find((item) => item.props.accessibilityLabel === 'Search');
  expect(tab.props.accessibilityState.selected).toBe(true);
  tap(tree, 'Search');
  expect(mockNavigate).toHaveBeenLastCalledWith('/(app)/(search)/search');
  expect(mockSearchFocus).not.toHaveBeenCalled();
  mockSegments = ['(app)', '(search)', 'search'];
  act(() => tree.update(<PerformanceTabs />));
  tap(tree, 'Search');
  expect(mockSearchFocus).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledTimes(2);
  act(() => tree.unmount());
});
