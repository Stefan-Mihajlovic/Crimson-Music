import { useLocalSearchParams } from 'expo-router';

import PlayerDetailsSheet from '@/components/player-details-sheet';

export default function PlayerDetailsScreen() {
  const params = useLocalSearchParams<{ tab?: 'queue' | 'lyrics' | 'related' }>();
  return <PlayerDetailsSheet initialTab={params.tab || 'queue'} />;
}
