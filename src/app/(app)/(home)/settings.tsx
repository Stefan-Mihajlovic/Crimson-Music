import { Redirect, type Href } from 'expo-router';

export default function SettingsRedirect() {
  return <Redirect href={'/(app)/(account)/account' as Href} />;
}
