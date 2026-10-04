import { useSyncExternalStore } from 'react';
import PerformanceTabs from '@/components/performance-tabs';
import { WEB_TAB_BAR_HEIGHT } from '@/components/player-layout';
import { useAppSettings } from '@/providers/settings-provider';
import { getServerWebPlayerMotion, getWebPlayerMotion, subscribeWebPlayerMotion } from '@/services/web-player-motion';

/** Keep the source navigation mounted and move it with the player, including cancelled drags. */
export default function WebMobileNavigation({ playerOpen, bottom, selectedGroup }: { playerOpen: boolean; bottom: number; selectedGroup: string }) {
  const motion = useSyncExternalStore(subscribeWebPlayerMotion, getWebPlayerMotion, getServerWebPlayerMotion);
  const { reduceMotion } = useAppSettings();
  const progress = !playerOpen ? 0 : motion.phase === 'rest' ? 1 : Math.max(0, Math.min(1, 1 - motion.position / motion.collapsedTop));
  // Fading this ancestor would isolate the tabs from the page they blur.
  return <div data-testid="mobile-navigation" inert={playerOpen} aria-hidden={playerOpen}
    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: bottom + WEB_TAB_BAR_HEIGHT,
      transform: `translateY(${progress * (bottom + WEB_TAB_BAR_HEIGHT + 8)}px)`,
      pointerEvents: playerOpen ? 'none' : 'auto',
      transition: motion.phase === 'settling' && !reduceMotion ? 'transform 280ms cubic-bezier(.2,.75,.22,1)' : 'none' }}>
    <PerformanceTabs bottom={bottom} selectedGroup={selectedGroup} />
  </div>;
}
