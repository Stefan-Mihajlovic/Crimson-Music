// Keep optional diagnostics out of the browser's critical loading path.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
const sentry = dsn && !__DEV__ ? import('@sentry/react-native').then((sdk) => {
  sdk.init({ dsn, enabled: true, sendDefaultPii: false, tracesSampleRate: 0.1,
    beforeSend(event) {
      delete event.user;
      delete event.request;
      if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.filter((crumb) => crumb.category !== 'console');
      return event;
    },
  });
  return sdk;
}).catch(() => null) : null;

export function reportError(error: unknown, operation: string) {
  if (__DEV__) console.warn(`[Crimson:${operation}]`, error instanceof Error ? error.message : 'Unexpected error');
  void sentry?.then((sdk) => sdk?.captureException(error, { tags: { operation } }));
}
export async function measureOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try { return await operation(); }
  finally { if (__DEV__) console.info(`[Crimson:timing] ${name}: ${Math.round(performance.now() - start)}ms`); }
}
// Expo Router's root ErrorBoundary already reports render failures. Loading a
// diagnostic SDK must not replace/remount the app or interrupt audio playback.
export function wrap<T>(component: T): T { return component; }
