import { useRouter } from 'expo-router';
import ResponsivePopup from '@/components/responsive-popup';
import VisualizerSheet from '@/components/visualizer-sheet';

export default function VisualizerScreen() {
  const router = useRouter();
  const close = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  return <ResponsivePopup label="Visualizer" onDismiss={close} width={480} expanded><VisualizerSheet onClose={close} /></ResponsivePopup>;
}
