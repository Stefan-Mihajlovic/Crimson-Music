import { useRouter } from 'expo-router';
import ResponsivePopup from '@/components/responsive-popup';
import PlaybackSpeedSheet from '@/components/playback-speed-sheet';

export default function PlaybackSpeedScreen() {
  const router = useRouter();
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  return <ResponsivePopup label="Playback speed" onDismiss={close} width={480} expanded><PlaybackSpeedSheet onClose={close} /></ResponsivePopup>;
}
