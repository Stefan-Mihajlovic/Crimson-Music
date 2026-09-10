import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn) && !__DEV__,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    delete event.user;
    delete event.request;
    if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.filter((crumb) => crumb.category !== 'console');
    return event;
  },
});

export function reportError(error: unknown, operation: string) {
  if (__DEV__) console.warn(`[Crimson:${operation}]`, error instanceof Error ? error.message : 'Unexpected error');
  Sentry.captureException(error, { tags: { operation } });
}

export async function measureOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await Sentry.startSpan({ name, op: 'app.load' }, operation);
  } finally {
    if (__DEV__) console.info(`[Crimson:timing] ${name}: ${Math.round(performance.now() - start)}ms`);
  }
}

export { wrap } from '@sentry/react-native';
