import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import { networkStatus, networkRetryDelay } from '@/services/network-state';

type NetworkContextValue = {
  isOffline: boolean;
  ready: boolean;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

NetInfo.configure({
  useNativeReachability: true,
  reachabilityUrl: 'https://api.audius.co/health_check',
  reachabilityMethod: 'GET',
  // An HTTP error is a reachable service failure, not a device disconnection.
  reachabilityTest: async (response) => response.status >= 200 && response.status < 600,
  reachabilityShortTimeout: 15_000,
  reachabilityLongTimeout: 60_000,
  reachabilityRequestTimeout: 5_000,
  // Do not gate reachabilityShouldRun on AppState: NetInfo 12 treats a skipped
  // check as unreachable, including during the inactive phase of app startup.
});

export function NetworkProvider({ children }: PropsWithChildren) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let mounted = true;
    let offline = false;
    let attempt = 0;
    let refreshing = false;
    let refreshAgain = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (!mounted || !offline || refreshing || timer || AppState.currentState !== 'active') return;
      timer = setTimeout(() => {
        timer = undefined;
        refresh();
      }, networkRetryDelay(attempt++));
    };
    const refresh = () => {
      if (!mounted) return;
      if (refreshing) {
        refreshAgain = true;
        return;
      }
      refreshing = true;
      void NetInfo.refresh().catch(() => undefined).finally(() => {
        refreshing = false;
        if (mounted && refreshAgain && AppState.currentState === 'active') {
          refreshAgain = false;
          refresh();
          return;
        }
        schedule();
      });
    };
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Background updates and in-flight checks from before foregrounding may
      // be stale. Keep the last confirmed status until the active refresh.
      if (!mounted || AppState.currentState !== 'active' || refreshAgain) return;
      const status = networkStatus(state, Platform.OS === 'web' ? 'web' : 'native');
      if (status === 'unknown') return;
      offline = status === 'offline';
      if (!offline) {
        attempt = 0;
        clearTimeout(timer);
        timer = undefined;
      }
      setIsOffline(offline);
      schedule();
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      clearTimeout(timer);
      timer = undefined;
      if (state === 'active') {
        attempt = 0;
        refresh();
      } else {
        refreshAgain = false;
      }
    });
    return () => {
      mounted = false;
      clearTimeout(timer);
      appStateSubscription.remove();
      unsubscribe();
    };
  }, []);

  // Unknown reachability must not hold the UI behind a network request.
  const value = useMemo(() => ({ isOffline, ready: true }), [isOffline]);
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) throw new Error('useNetwork must be used inside NetworkProvider.');
  return context;
}
