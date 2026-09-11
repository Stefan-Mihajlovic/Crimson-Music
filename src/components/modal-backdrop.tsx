import { BlurTargetView } from 'expo-blur';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { FrostedBackdrop, FrostedBackdropProvider } from '@/components/frosted-surface';

type Entry = { key: symbol; view: View };
type Registry = { entries: Entry[]; register: (key: symbol, view: View | null) => void };
const ModalBackdropContext = createContext<Registry>({ entries: [], register: () => {} });

export function ModalBackdropProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const register = useCallback((key: symbol, view: View | null) => {
    setEntries((current) => {
      if (current.find((entry) => entry.key === key)?.view === view) return current;
      const rest = current.filter((entry) => entry.key !== key);
      return view ? [...rest, { key, view }] : rest;
    });
  }, []);
  const value = useMemo(() => ({ entries, register }), [entries, register]);
  return <ModalBackdropContext.Provider value={value}>{children}</ModalBackdropContext.Provider>;
}

/** Only ordinary root-stack scenes are targets; modal surfaces never capture themselves. */
export function ModalBackdropScene({ children }: { children: ReactNode }) {
  const nativeRef = useRef<View | null>(null);
  const [key] = useState(() => Symbol('scene'));
  const { register } = useContext(ModalBackdropContext);
  useEffect(() => () => register(key, null), [key, register]);
  if (Platform.OS !== 'android') return <>{children}</>;
  return <BlurTargetView ref={nativeRef} onLayout={() => register(key, nativeRef.current)} style={styles.fill}>{children}</BlurTargetView>;
}

export function ModalFrostedSurface({ children }: { children: ReactNode }) {
  const { entries } = useContext(ModalBackdropContext);
  const view = entries.at(-1)?.view ?? null;
  const target = useMemo(() => ({ current: view }), [view]);
  if (Platform.OS === 'ios') return <>{children}</>;
  return <FrostedBackdropProvider target={target}>
    <View style={styles.fill}>
      <FrostedBackdrop radius={0} intensity={76} />
      {children}
    </View>
  </FrostedBackdropProvider>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
