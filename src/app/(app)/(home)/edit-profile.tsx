import { Redirect } from 'expo-router';

export default function LegacyProfileEditorRedirect() {
  return <Redirect href="/(app)/(home)/profile" />;
}
