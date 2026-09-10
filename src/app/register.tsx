import { Redirect } from 'expo-router';

export default function LegacyAuthRedirect() {
  return <Redirect href="/welcome" />;
}
