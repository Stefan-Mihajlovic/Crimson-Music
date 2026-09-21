type NetworkState = { type?: string; isConnected: boolean | null; isInternetReachable: boolean | null };

export function networkStatus(state: NetworkState, platform: 'native' | 'web' = 'native'): 'online' | 'offline' | 'unknown' {
  // NetInfo's native initial "unknown" interface can report connected=false.
  // That is an uninitialized snapshot, unlike an explicit "none" interface.
  // On web, connected comes from navigator.onLine even when the interface type
  // is unavailable, so an unknown type still carries a real offline signal.
  if (platform !== 'web' && state.type === 'unknown' && state.isConnected !== true) return 'unknown';
  if (state.type === 'none' || state.isConnected === false || state.isInternetReachable === false) return 'offline';
  if (state.isInternetReachable === true) return 'online';
  return 'unknown';
}

export function networkIsOffline(state: NetworkState) {
  return networkStatus(state) === 'offline';
}

export function networkRetryDelay(attempt: number) {
  return Math.min(60_000, 5_000 * 2 ** Math.min(Math.max(attempt, 0), 4));
}
