import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ProfileScreen from '../../src/app/(app)/(home)/profile';
import { recapDeckLayout } from '../../src/components/recap-deck-layout';

let mockWidth = 393;
jest.mock('react-native-web/dist/exports/useWindowDimensions', () => () => ({ width: mockWidth, height: 852, scale: 1, fontScale: 1 }));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn() }),
  useSegments: () => ['(app)', '(account)'],
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native-web').View, ScrollView: require('react-native-web').ScrollView },
  useSharedValue: (value) => require('react').useRef({ value }).current,
  useAnimatedStyle: (callback) => callback(),
  useAnimatedScrollHandler: () => undefined,
  Extrapolation: { CLAMP: 'clamp' },
  interpolate: (_value, _input, output) => output[0],
}));
jest.mock('../../src/components/app-symbol', () => ({ SymbolView: () => null }));
jest.mock('../../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { uid: 'listener', Username: 'listener', DisplayName: 'Listener' } }) }));
jest.mock('../../src/providers/player-provider', () => ({ usePlayer: () => ({ playSong: jest.fn() }) }));
jest.mock('../../src/providers/settings-provider', () => ({ useAppSettings: () => ({
  reduceMotion: true,
  colors: { background: '#111', controlSurface: '#222', text: '#fff', secondaryText: '#aaa', border: '#333', accent: '#95f' },
}) }));
jest.mock('../../src/services/music', () => ({
  loadMonthlyListeningStats: async () => ({ plays: 159, minutes: 179, uniqueTracks: 12, artists: 4, longestStreak: 3, topTracks: [], topArtists: [] }),
  subscribeLocalListeningHistory: () => () => undefined,
}));
jest.mock('../../src/services/audius', () => ({ getAudiusTrack: jest.fn() }));
jest.mock('../../src/services/audius-session', () => ({ getCurrentAudiusUserId: () => 'listener' }));
jest.mock('../../src/services/action-sheet', () => ({ useDetailRoutes: () => ({ artistHref: (id) => `/artist/${id}` }) }));

let root;
let container;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

test.each([393, 1440])('web recap preserves the opening gutter and centers later cards at %ipx', async (width) => {
  mockWidth = width;
  await act(async () => root.render(<ProfileScreen />));
  const first = container.querySelector('[aria-label="Plays: 159"]');
  expect(first).not.toBeNull();
  const content = first.parentElement;
  const scroller = content.parentElement;
  const cards = [...content.children];
  const layout = recapDeckLayout(width, cards.length);
  expect(getComputedStyle(scroller).scrollSnapType).toBe('x mandatory');
  expect(parseFloat(getComputedStyle(content).paddingLeft)).toBe(layout.leadingInset);
  expect(parseFloat(getComputedStyle(content).paddingRight)).toBe(layout.trailingInset);
  // Validate the actual RN Web DOM/CSS, not just the native snapToOffsets prop.
  let cardLeft = layout.leadingInset;
  cards.forEach((card, index) => {
    const css = getComputedStyle(card);
    const cardWidth = parseFloat(css.width);
    const marginLeft = parseFloat(css.scrollMarginLeft);
    expect(css.scrollSnapAlign).toBe(index === 0 ? 'start' : 'center');
    expect(css.scrollSnapStop).toBe('always');
    const cssSnapOffset = index === 0 ? cardLeft - marginLeft : cardLeft + cardWidth / 2 - width / 2;
    expect(cssSnapOffset).toBe(layout.snapOffsets[index]);
    cardLeft += cardWidth + parseFloat(css.marginRight) + layout.gap;
  });
});
