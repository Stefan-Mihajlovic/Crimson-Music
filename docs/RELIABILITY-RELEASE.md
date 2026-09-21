# Release validation

Record the source revision, build configuration, affected platforms, and results in the pull request or release notes. Compilation and automated tests do not establish runtime support on every device.

## Automated checks

```bash
npm run check
npm test
npx expo-doctor
```

`npm test` includes unit, shared integration, and Android/web regression suites. Native changes also require fresh Android and iOS builds from the canonical plugins and patch scripts; see [PLATFORMS.md](PLATFORMS.md). Configure the public Audius app key and registered callbacks for login checks.

## Device and browser checks

1. Complete Audius login and return through the registered callback. Check cancellation, session restoration, expired-session recovery, and sign-out.
2. Switch accounts and confirm profile, library, pending requests, downloads, and widget state remain isolated. Test Clear Data & Disconnect, including a failed cleanup.
3. Exercise discovery, filtered search, Favorites, follows, playlist editing, and streaming with a test account.
4. Check queue operations, crossfade, equalizer, sleep timer, background playback, lock-screen controls, Bluetooth/headsets, and audio interruptions. Verify both audio decks stop when a sleep timer expires.
5. Relaunch without networking and play downloaded/imported audio. Check permission denial, Local Music rescans, interrupted downloads, and reconnecting without a false offline banner.
6. Add each widget size and test actions with the app running and terminated.
7. Check popup resizing, keyboard interactions, large text, screen readers, Reduce Motion, and Performance Mode. Test hosted-origin OAuth and browser suspension separately from local web builds.

## Release configuration

Use distribution signing for published native builds; local development keys are unsuitable for store releases. Keep signing material and source-map upload tokens private.

Sentry reporting stays disabled without `EXPO_PUBLIC_SENTRY_DSN`. If enabled for a release, review the receiving project and verify a symbolicated report. See [privacy](PRIVACY.md) and [publishing](PUBLISHING.md).
