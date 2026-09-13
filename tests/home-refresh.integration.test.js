import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';
import HomeScreen from '../src/app/(app)/(home)/index';

let mockTopInset = 59;
const mockColors = { accent: '#965CFF', background: '#0E0D13', text: '#fff', secondaryText: '#aaa', border: '#333' };
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: mockTopInset, bottom: 34, left: 0, right: 0 }) }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { ScrollView: require('react-native').ScrollView } }));
jest.mock('../src/hooks/use-main-header-scroll', () => ({ useMainHeaderScroll: () => ({ offset: { value: 0 }, onScroll: jest.fn() }) }));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { uid: 'listener', FavoriteCategories: [], RecommendationStyle: 'balanced' } }) }));
jest.mock('../src/providers/player-provider', () => ({ usePlayer: () => ({ playSong: jest.fn() }) }));
jest.mock('../src/providers/network-provider', () => ({ useNetwork: () => ({ isOffline: false }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: mockColors, reduceMotion: true, performanceMode: false, dataSaver: false }) }));
jest.mock('../src/components/main-screen-background', () => ({ children }) => children);
jest.mock('../src/components/main-native-header', () => () => null);
jest.mock('../src/components/main-header-overlay', () => ({ __esModule: true, default: () => null, MainHeaderSpacer: () => null }));
jest.mock('../src/components/frosted-surface', () => ({ FrostedLayer: ({ children }) => children }));
jest.mock('../src/components/vault-glass-button', () => () => null);
jest.mock('../src/components/home-quick-access', () => () => null);
jest.mock('../src/components/home-discovery', () => () => null);
jest.mock('../src/components/app-symbol', () => ({ SymbolView: () => null }));
jest.mock('../src/components/artwork-image', () => () => null);
jest.mock('../src/components/now-playing-artwork', () => ({ CollectionPlayingOverlay: () => null }));
jest.mock('../src/components/playlist-cover', () => () => null);
jest.mock('../src/components/song-list-row', () => () => null);
jest.mock('../src/services/action-sheet', () => ({ useDetailRoutes: () => ({ artistHref: jest.fn(), playlistHref: jest.fn() }) }));
jest.mock('../src/services/telemetry', () => ({ measureOperation: (_name, action) => action(), reportError: jest.fn() }));
jest.mock('../src/services/account-lifecycle', () => ({ registerAccountCleanup: jest.fn(), isAccountDeleted: () => false }));
jest.mock('../src/services/music', () => ({
  readOfflineData: async () => null,
  loadHomeFeed: async () => ({ songs: [], artists: [], playlists: [], featuredArtist: null, newReleases: [] }),
}));

let root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { if (root) await act(async () => root.unmount()); Platform.OS = 'ios'; });
const homeScroll = () => root.root.findAllByType(ScrollView).find((view) => view.props.refreshControl);

test.each([['ios', 59], ['ios', 20], ['android', 24]])('%s Home refresh clears the %ipx status area without adding header spacing', async (platform, inset) => {
  Platform.OS = platform;
  mockTopInset = inset;
  await act(async () => { root = create(<HomeScreen />); });
  const scroll = homeScroll();
  const refresh = root.root.findByType(RefreshControl);
  expect(refresh.props.progressViewOffset).toBe(inset);
  expect(refresh.props.tintColor).toBe(mockColors.accent);
  expect(refresh.props.colors).toEqual([mockColors.accent]);
  expect(refresh.props.refreshing).toBe(false);
  expect(scroll.props.contentInsetAdjustmentBehavior).toBe('never');
  expect(scroll.props.contentInset).toBeUndefined();
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingTop).toBe(inset);

  mockTopInset = 0;
  await act(async () => root.update(<HomeScreen />));
  expect(root.root.findByType(RefreshControl).props.progressViewOffset).toBe(0);
  expect(StyleSheet.flatten(homeScroll().props.contentContainerStyle).paddingTop).toBe(0);
});

test('web Home leaves native refresh positioning unset', async () => {
  Platform.OS = 'web';
  mockTopInset = 0;
  await act(async () => { root = create(<HomeScreen />); });
  expect(root.root.findByType(RefreshControl).props.progressViewOffset).toBeUndefined();
  expect(StyleSheet.flatten(homeScroll().props.contentContainerStyle).paddingTop).toBe(0);
});
