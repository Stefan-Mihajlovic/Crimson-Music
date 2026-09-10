import { Href, useRootNavigationState, useSegments } from 'expo-router';

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
};

export function actionSheetHref(item: ActionSheetItem) {
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
