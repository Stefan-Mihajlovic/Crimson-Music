import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { useAuth } from '@/providers/auth-provider';

export default function AppLayout() {
  const { user } = useAuth();
  if (!user) {
    return <Redirect href="/welcome" />;
  }
  return <AppTabs />;
}
