// Netlify must fail before publishing an unusable login screen. Local Expo
// exports may intentionally be unauthenticated CI compilation checks.
process.env.NODE_ENV ||= 'production';
require('@expo/env').load(process.cwd());
if (!process.env.EXPO_PUBLIC_AUDIUS_API_KEY?.trim()) {
  console.error('Missing EXPO_PUBLIC_AUDIUS_API_KEY: set the public Audius app key in the hosting build environment before publishing.');
  process.exit(1);
}
console.log('Public Audius login configuration is present.');
