export function networkIsOffline(state: { isConnected: boolean | null; isInternetReachable: boolean | null }) {
  return state.isConnected === false || state.isInternetReachable === false;
}

export function networkRetryDelay(attempt: number) {
  return Math.min(60_000, 5_000 * 2 ** Math.min(Math.max(attempt, 0), 4));
}
