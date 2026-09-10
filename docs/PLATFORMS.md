# Platform support and builds

Crimson uses Expo 57 and React Native. iOS is the primary development target. Android and web are experimental ports: source availability and successful compilation do not establish equivalent behavior on those platforms.

## Current support

| Capability | iOS | Android | Web |
| --- | --- | --- | --- |
| Audius login, catalog, streaming, library actions | Primary implementation | Shared implementation; experimental | Shared implementation; experimental |
| Session storage | SecureStore | SecureStore | Tab-scoped `sessionStorage` |
| Native glass and SwiftUI controls | iOS-specific implementation | Fallback controls | Fallback controls |
| Crimson custom previous/next/like lock-screen commands | Native integration | Not implemented | Not implemented |
| Cover-pixel palette extraction and native circular tab artwork | Native integration | No equivalent native module | No equivalent native module |
| Offline downloads | Native implementation | Shared native implementation; needs platform validation | Unsupported |
| Voice search | OS speech recognition | Device/service dependent | Browser dependent |

Basic audio functionality comes from `expo-audio`; the custom remote-control row above describes Crimson's additional native integration. Browser autoplay rules and tab suspension can limit web playback. The web navigation layout also differs from the native app.

Notifications are loaded from Audius inside the app. This repository does not implement push notification delivery. Some notification destinations and marking notifications read require the Audius interface.

## Prerequisites

- Node.js 24 and npm; install the lockfile with `npm ci`.
- A registered Audius application and its public app key, configured using `.env.example`.
- iOS: macOS, Xcode, its command-line tools, and an appropriate signing setup for physical devices.
- Android: Android Studio, the Android SDK, and its compatible JDK/toolchain.
- Web: a modern browser; use HTTPS for a hosted build.

**Expo Go is unsupported.** Native development or standalone builds are required for the callback scheme, speech recognition, and custom native integrations.

## Audius registration

Set `EXPO_PUBLIC_AUDIUS_API_KEY` to your application's public key. Native login uses `crimsonmusic://oauth/callback`. Web login uses the current origin with `/oauth/callback`, so register each exact development or deployed origin you use. If your development server uses another port, its callback must match that port.

Crimson requests authorization-code OAuth with PKCE and the `write` scope for library management. Password entry occurs on Audius. The public app identifier is still required, even though account requests use each listener's token. It is not a promise that requests bypass Audius limits.

## Native development

```bash
npm ci
npm run ios
# or
npm run android
```

These commands generate/build native projects as needed. After installing a development build, `npm start` starts Metro. Rebuild whenever native dependencies, plugins, or app configuration change.

For a connected iPhone:

```bash
npm run ios:device
# Metro-connected development build:
npm run ios:device:dev
```

For your own fork, configure `IOS_BUNDLE_IDENTIFIER` and `ANDROID_PACKAGE` in `.env`. `IOS_APPLE_TEAM_ID` is optional and selects your iOS signing team. These are read by `app.config.js`; the checked-in defaults are not a grant to use someone else's signing identity. Changing the bundle/package identifier does not change the `crimsonmusic` callback scheme.

Native sources are generated. Put persistent native modifications in `plugins/`, `app.config.js`/`app.json`, or the patch scripts. If you need a clean regeneration after changing native configuration:

```bash
npx expo prebuild --clean
node scripts/fix-expo-ios-paths.js
```

`--clean` replaces the generated native directories, so preserve any necessary native changes in their canonical sources first. The postinstall and iOS preparation scripts apply project-specific compatibility patches, including build paths, scene URL forwarding, and native module integration.

## Web development and export

```bash
npm run web
```

Allow the login popup and keep its original tab open while authorization completes. Web sessions persist in that tab's `sessionStorage`, not a native credential store. Downloads for offline listening are not supported on web.

The project configures a static web export:

```bash
npx expo export --platform web
```

Host the generated `dist/` output with HTTPS and ensure a direct request to `/oauth/callback` resolves correctly. Register the hosted origin's exact callback in Audius and set public build-time configuration before export. A static export is not a deployment or evidence of a successful browser OAuth/playback session.

## Release validation

Use the [release validation checklist](RELIABILITY-RELEASE.md) and state which devices and browsers were actually exercised. Android and web improvements are welcome; do not describe them as production-equivalent to iOS until their relevant flows have been validated.
