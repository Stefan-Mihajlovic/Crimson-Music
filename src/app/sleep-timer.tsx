import { useRouter } from 'expo-router';
import ResponsivePopup from '@/components/responsive-popup';
import SleepTimerSheet from '@/components/sleep-timer-sheet';
import { usePlayer, useSleepTimer } from '@/providers/player-provider';

export default function SleepTimerScreen() {
  const router = useRouter();
  const timer = useSleepTimer();
  const { currentSong, sleepTimer, startSleepTimer } = usePlayer();
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  return <ResponsivePopup label="Sleep timer" onDismiss={close} width={440} expanded>
    <SleepTimerSheet timer={timer} currentSongTitle={currentSong?.title} onStartMinutes={startSleepTimer}
      onEndCurrentSong={() => startSleepTimer('end-of-track')} onCancel={() => sleepTimer.cancel()} onClose={close} />
  </ResponsivePopup>;
}
