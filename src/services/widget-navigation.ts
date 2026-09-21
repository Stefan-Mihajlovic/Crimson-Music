type WidgetRoute = { name: string; key?: string; params?: object; state?: WidgetNavigationState };
export type WidgetNavigationState = { index?: number; key?: string; type?: string; stale?: boolean; routeNames?: string[]; routes: WidgetRoute[] };
let routeSequence = 0;
export type WidgetDestination = {
  group: '(home)' | '(library)';
  screen: 'index' | 'library' | 'favorites' | 'local-music' | 'history' | 'mix';
  params?: Record<string, string>;
};

/**
 * Widget links arrive above the current presentation. Replacing just /widget
 * retained old /player screens underneath it. Return to the existing tab host
 * and reuse collection routes there, preserving the other tabs and their keys.
 */
export function widgetNavigationState(state: WidgetNavigationState | undefined, destination?: WidgetDestination): WidgetNavigationState {
  let app = state?.routes.find((route) => route.name === '(app)') || { name: '(app)' };
  if (destination) {
    const tabs = app.state;
    const tabRoutes = [...(tabs?.routes || [])];
    let tabIndex = tabRoutes.findIndex((route) => route.name === destination.group);
    const tab = tabRoutes[tabIndex] || { name: destination.group, key: `widget-${destination.group}-${++routeSequence}` };
    const initialScreen = destination.group === '(home)' ? 'index' : 'library';
    const stackRoutes = [...(tab.state?.routes || [{ name: initialScreen }])];
    // One screen per collection type. A different mix updates its existing
    // params instead of stacking another copy of the same mix screen.
    const existingIndex = stackRoutes.findIndex((route) => route.name === destination.screen);
    const screen = { ...(stackRoutes[existingIndex] || { name: destination.screen, key: `widget-${destination.screen}-${++routeSequence}` }), params: destination.params };
    const routes = existingIndex < 0 ? [...stackRoutes, screen] : [...stackRoutes.slice(0, existingIndex), screen];
    const nextTab = { ...tab, params: undefined, state: { ...tab.state, index: routes.length - 1, routes } };
    if (tabIndex < 0) { tabIndex = tabRoutes.length; tabRoutes.push(nextTab); }
    else tabRoutes[tabIndex] = nextTab;
    app = { ...app, params: undefined, state: { ...tabs, index: tabIndex, routes: tabRoutes } };
  }
  return { ...state, index: 0, routes: [app] };
}

const presentationListeners = new Set<(expanded: boolean) => void>();
let pendingPresentation: boolean | undefined;

/** The tab host owns the one draggable player; retain cold-launch requests until it mounts. */
export function requestWidgetPlayerPresentation(expanded: boolean) {
  if (!presentationListeners.size) { pendingPresentation = expanded; return; }
  pendingPresentation = undefined;
  presentationListeners.forEach((listener) => listener(expanded));
}

export function subscribeToWidgetPlayerPresentation(listener: (expanded: boolean) => void) {
  presentationListeners.add(listener);
  if (pendingPresentation !== undefined) {
    const expanded = pendingPresentation;
    pendingPresentation = undefined;
    listener(expanded);
  }
  return () => { presentationListeners.delete(listener); };
}

let playRequest = 0;
export function nextWidgetPlayRequest() { return `${Date.now()}-${++playRequest}`; }
