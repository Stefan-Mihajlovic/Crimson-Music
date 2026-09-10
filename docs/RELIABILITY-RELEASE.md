# Audius client release validation

Crimson's account and music flows now target Audius directly. The app has no Firebase SDK, deployment workflow, Cloud Functions, database rules, Google sign-in clients or native App Check requirement. Earlier backend rollout instructions and measurements do not describe this architecture.

## Automated checks

Run `npm run check`, `npm run test:unit`, `npm run test:integration`, and `npx expo-doctor`. Tests should cover account-switch races, OAuth callback validation, direct Audius library loading, local persistence, player/autoplay races, download cancellation, network recovery and native build scripts.

Configuration tests prevent accidental Firebase dependencies and ensure Crimson's OAuth callback scheme and secure storage/browser plugins remain configured. Automated tests cannot establish a successful real Audius authorization or playback on every device.

## Device release checks

1. Build a fresh native app after regenerating its native project. A previously installed binary can still contain removed native modules until rebuilt.
2. Complete Audius login in the system browser and return to Crimson. Verify cancellation, failed authorization, session restoration and sign-out.
3. Verify that switching Audius accounts changes the displayed profile and library, with no previous account's pending request restoring stale data.
4. Check discovery, search, favorites, follows, playlists and streaming against the signed-in Audius account. Verify permission failures and expired-session recovery are explained clearly in the interface.
5. Exercise background playback, interruptions, lock-screen controls, offline transitions and local download handling on physical devices.
6. Verify accessibility labels, large text, screen readers and reduced-motion behavior.

## Optional Sentry reporting

Leave `EXPO_PUBLIC_SENTRY_DSN` empty to keep remote crash reporting disabled. If enabled, store upload credentials only as private CI/build secrets and verify a symbolicated report. These credentials are unrelated to Audius OAuth.

## Historical infrastructure

Removing Firebase from this repository does not delete any previously deployed cloud resources or change another client's data. Local environment and secret files are left untouched; obsolete Firebase and Google client settings are no longer read by the Audius app. Any cloud billing cancellation or resource deletion is a separate account operation.
