import { ModalFrostedSurface } from '@/components/modal-backdrop';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import PlayerDetailsSheet from '@/components/player-details-sheet';
import ResponsivePopup from '@/components/responsive-popup';

export default function PlayerDetailsScreen() {
  const params = useLocalSearchParams<{ tab?: 'queue' | 'lyrics' | 'related' }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  if (Platform.OS === 'web' && width >= 960) return <Redirect href={{ pathname: '/player', params: { tab: params.tab || 'queue' } }} />;
  const content = <PlayerDetailsSheet initialTab={params.tab || 'queue'} />;
  if (Platform.OS === 'web') return <ResponsivePopup label="Player details" expanded onDismiss={() => router.canGoBack() ? router.back() : router.replace('/player')}>{content}</ResponsivePopup>;
  // iOS form sheets need a direct native ScrollView child for viewport sizing.
  // Android modals need their own gesture root.
  return Platform.OS === 'android'
    ? <GestureHandlerRootView style={{ flex: 1 }}><ModalFrostedSurface>{content}</ModalFrostedSurface></GestureHandlerRootView>
    : <ModalFrostedSurface>{content}</ModalFrostedSurface>;
}
