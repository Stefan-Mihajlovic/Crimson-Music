import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import { usePlayer, usePlayerStatus } from '@/providers/player-provider';
import { createWidgetSnapshot, updateWidgets } from '@/services/widgets';
import { reportError } from '@/services/telemetry';

/** Publish only track/transport changes; playback position must not spend widget refresh budget. */
export default function WidgetSync() {
  const { user, ready: authReady } = useAuth();
  const { currentSong, nextSong, previousSong, source, ready: playerReady } = usePlayer();
  const { playing } = usePlayerStatus();
  useEffect(() => {
    if (Platform.OS === 'web' || !authReady || (user && !playerReady)) return;
    void updateWidgets(createWidgetSnapshot({
      signedIn: Boolean(user), song: currentSong, playing,
      nextSong, previousSong, source,
    })).catch((error) => reportError(error, 'widgets.snapshot'));
  }, [authReady, currentSong, nextSong, playerReady, playing, previousSong, source, user]);
  return null;
}
