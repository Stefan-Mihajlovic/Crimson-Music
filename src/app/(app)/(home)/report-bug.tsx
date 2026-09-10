import { Redirect } from 'expo-router';

export default function LegacyBugReportRedirect() {
  return <Redirect href="/(app)/(home)/settings" />;
}
