import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { useAuth } from '@/providers/auth-provider';

export default function AppLayout() {
  const { user, onboardingComplete } = useAuth();
  if (!user) {
    return <Redirect href="/welcome" />;
  }
  if (!onboardingComplete) return <Redirect href="/onboarding" />;
  return <AppTabs />;
}
