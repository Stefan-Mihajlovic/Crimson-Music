import { Redirect } from 'expo-router';

export default function MusicPreferencesScreen() {
  return <Redirect href={{ pathname: '/onboarding', params: { mode: 'edit' } }} />;
}
