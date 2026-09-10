import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { networkIsOffline, networkRetryDelay } from '@/services/network-state';

type NetworkContextValue = {
  isOffline: boolean;
  ready: boolean;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

NetInfo.configure({
  useNativeReachability: true,
  reachabilityUrl: 'https://api.audius.co/health_check',
  reachabilityMethod: 'GET',
  reachabilityTest: async (response) => response.ok,
  reachabilityShortTimeout: 15_000,
  reachabilityLongTimeout: 60_000,
  reachabilityRequestTimeout: 5_000,
  reachabilityShouldRun: () => AppState.currentState === 'active',
});

export function NetworkProvider({ children }: PropsWithChildren) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let mounted = true;
    let offline = false;
    let attempt = 0;
    let refreshing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (!mounted || !offline || refreshing || timer || AppState.currentState !== 'active') return;
      timer = setTimeout(() => {
        timer = undefined;
        refresh();
      }, networkRetryDelay(attempt++));
    };
    const refresh = () => {
      if (!mounted || refreshing) return;
      refreshing = true;
      void NetInfo.refresh().catch(() => undefined).finally(() => {
        refreshing = false;
        schedule();
      });
    };
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!mounted) return;
      offline = networkIsOffline(state);
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
