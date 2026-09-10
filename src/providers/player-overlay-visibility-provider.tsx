import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

type PlayerOverlayState = { visible: boolean; position?: SharedValue<number> };
const PlayerOverlayVisibilityContext = createContext<PlayerOverlayState>({ visible: false });

/** In-place player presentation does not change the current navigation route. */
export function PlayerOverlayVisibilityProvider({ visible, position, children }: {
  visible: boolean;
  position: SharedValue<number>;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ visible, position }), [visible, position]);
  return <PlayerOverlayVisibilityContext value={value}>{children}</PlayerOverlayVisibilityContext>;
}

export function usePlayerOverlayVisible() {
  return useContext(PlayerOverlayVisibilityContext).visible;
}

/** Screen-space top edge, updated by the player's gesture on the UI thread. */
export function usePlayerOverlayPosition() {
  return useContext(PlayerOverlayVisibilityContext).position;
}
