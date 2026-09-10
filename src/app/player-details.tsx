import { useLocalSearchParams } from 'expo-router';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import PlayerDetailsSheet from '@/components/player-details-sheet';

export default function PlayerDetailsScreen() {
  const params = useLocalSearchParams<{ tab?: 'queue' | 'lyrics' | 'related' }>();
  const content = <PlayerDetailsSheet initialTab={params.tab || 'queue'} />;
  // iOS form sheets need a direct native ScrollView child for viewport sizing.
  // Android modals need their own gesture root.
  return Platform.OS === 'android'
    ? <GestureHandlerRootView style={{ flex: 1 }}>{content}</GestureHandlerRootView>
    : content;
}
