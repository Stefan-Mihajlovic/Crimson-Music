import { Href, useRootNavigationState, useSegments } from 'expo-router';
import { Platform } from 'react-native';
import { releaseWebNavigationFocus } from '@/services/navigation-focus';
export { releaseWebNavigationFocus } from '@/services/navigation-focus';

export type AppRouteGroup = '(home)' | '(search)' | '(library)' | '(account)';

export type ActionSheetItem = {
  type: 'song' | 'artist' | 'playlist';
  id: string;
  title: string;
  subtitle: string;
  image: string;
  artistId?: string;
  coverImages?: string[];
  source?: 'audius' | 'crimson';
  playerPresentation?: 'overlay' | 'modal';
};

export type ActionSheetAnchor = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  trigger: HTMLElement;
};

let webPresentation: { id: string; openedAt: number; anchor: ActionSheetAnchor | null } | null = null;

/** Capture before navigation hides the source screen and moves browser focus. */
function captureWebPresentation(id: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof HTMLElement === 'undefined') return;
  const active = document.activeElement;
  const trigger = active instanceof HTMLElement
    ? active.closest<HTMLElement>('button, [role="button"], a, [tabindex="0"]')
    : null;
  const bounds = trigger?.getBoundingClientRect();
  const anchor = trigger && bounds && bounds.width > 0 && bounds.height > 0
    ? { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, trigger }
    : null;
  webPresentation = { id, openedAt: Date.now(), anchor };
  // React Navigation marks the underlying scene aria-hidden during presentation.
  // Release its focused trigger first; the popup restores it when dismissed.
  releaseWebNavigationFocus();
}

export function getActionSheetAnchor(id: string): ActionSheetAnchor | null {
  return webPresentation?.id === id && Date.now() - webPresentation.openedAt < 5000
    ? webPresentation.anchor
    : null;
}

export function actionSheetHref(item: ActionSheetItem) {
  captureWebPresentation(item.id);
  const { coverImages, ...params } = item;
  return {
    pathname: '/action-sheet',
    params: {
      ...params,
      ...(coverImages?.length ? { coverImages: JSON.stringify(coverImages.slice(0, 4)) } : {}),
    },
  } as Href;
}

type RouteState = { index?: number; routes: readonly { name: string; state?: RouteState }[] };

function groupFromState(state?: RouteState): AppRouteGroup | undefined {
  if (!state) return undefined;
  const route = state.routes[state.index ?? 0];
  if (route && ['(home)', '(search)', '(library)', '(account)'].includes(route.name)) return route.name as AppRouteGroup;
  // Root sheets sit above the app; keep their source tab's navigation stack.
  return groupFromState(route?.state) || groupFromState(state.routes.find((item) => item.name === '(app)')?.state);
}

export function useDetailRoutes() {
  const segments = useSegments();
  const state = useRootNavigationState();
  const group = segments.find((segment) => ['(home)', '(search)', '(library)', '(account)'].includes(segment)) as AppRouteGroup | undefined;
  return createDetailRoutes(group || groupFromState(state) || '(home)');
}

export function createDetailRoutes(group: AppRouteGroup) {
  const detailHref = (pathname: string, params?: Record<string, string>) => ({
    pathname: `/(app)/${group}/${pathname}`,
    params,
  }) as Href;

function artistHref(id: string) {
  return detailHref('artist', { id });
}

function artistTracksHref(id: string, name: string) {
  return detailHref('artist-tracks', { id, name });
}

function eventHref(id: string) {
  return detailHref('event', { id });
}

function playlistHref(id: string, owned = false, source?: 'audius' | 'crimson', title?: string) {
  return detailHref('playlist', {
    id,
    ...(owned ? { owned: '1' } : {}),
    ...(source ? { source } : {}),
    ...(title ? { title } : {}),
  });
}

function categoryHref(id: string) {
  return detailHref('category', { id });
}

function favoritesHref() {
  return detailHref('favorites');
}

function historyHref() {
  return detailHref('history');
}

function settingsHref() {
  return { pathname: '/(app)/(account)/account' } as Href;
}
function notificationsHref() {
  return detailHref('notifications');
}

  return { notificationsHref, artistHref, artistTracksHref, eventHref, playlistHref, categoryHref, favoritesHref, historyHref, settingsHref };
}
