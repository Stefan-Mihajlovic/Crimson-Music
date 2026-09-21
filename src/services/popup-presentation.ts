import type { NativeStackNavigationOptions } from 'expo-router/native-stack';

export const popupRouteNames = ['action-sheet', 'player-details', 'search-filters', 'playlist-editor', 'sleep-timer', 'equalizer'];

/** All app popups use the same platform presentation and native drag behavior. */
export function popupPresentationOptions({ platform, elevated, performanceMode, reduceMotion, detent = 0.5 }: {
  platform: string;
  elevated: string;
  performanceMode: boolean;
  reduceMotion: boolean;
  detent?: number;
}): NativeStackNavigationOptions {
  return {
    presentation: platform === 'web' ? 'transparentModal' : 'formSheet',
    animation: platform === 'web' || reduceMotion ? 'none' : 'slide_from_bottom',
    contentStyle: { backgroundColor: platform === 'web' ? 'transparent' : platform === 'ios' || performanceMode ? elevated : 'transparent' },
    sheetAllowedDetents: [detent, 1],
    sheetInitialDetentIndex: 0,
    sheetGrabberVisible: true,
    sheetExpandsWhenScrolledToEdge: true,
  };
}
