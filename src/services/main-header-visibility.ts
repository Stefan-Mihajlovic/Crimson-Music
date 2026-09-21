import { popupRouteNames } from '@/services/popup-presentation';

type RouteState = {
  index?: number;
  routes: readonly { key?: string; name: string; state?: RouteState }[];
};

const sheetRoutes = new Set([...popupRouteNames, 'edit-profile']);

/** Follow the selected page underneath sheets, without reviving other tabs or pushed pages. */
export function isMainHeaderBehindPopup(state: RouteState | undefined, routeKey: string): boolean {
  let current = state;
  let covered = false;
  while (current) {
    let index = current.index ?? 0;
    while (index > 0 && sheetRoutes.has(current.routes[index]?.name ?? '')) {
      covered = true;
      index -= 1;
    }
    const route = current.routes[index];
    if (!route) return false;
    if (route.key === routeKey) return covered;
    current = route.state;
  }
  return false;
}
