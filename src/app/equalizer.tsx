import { useRouter } from 'expo-router';
import EqualizerSheet from '@/components/equalizer-sheet';
import ResponsivePopup from '@/components/responsive-popup';

export default function EqualizerScreen() {
  const router = useRouter();
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  return <ResponsivePopup label="Equalizer" onDismiss={close} width={540} expanded><EqualizerSheet onClose={close} /></ResponsivePopup>;
}
