import { Href, Redirect } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';

export default function EntryScreen() {
  const { user } = useAuth();
  const { isOffline } = useNetwork();

  if (!user) {
    return <Redirect href="/welcome" />;
  }
  if (isOffline) {
    return <Redirect href={'/(app)/(home)/offline-listening?auto=1' as Href} />;
  }
  return <Redirect href="/(app)/(home)" />;
}
