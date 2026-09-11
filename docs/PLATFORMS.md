# Platform support and builds

Crimson uses Expo 57 and React Native and supports iOS, Android, and web. The core Audius account, catalog, and playback flows share an implementation, with platform-specific controls and the limits below. Support does not imply identical OS features or validation on every device/browser. See the [runtime validation record](PLATFORM-VALIDATION.md).

## Current support

| Capability | iOS | Android | Web |
| --- | --- | --- | --- |
| Audius login, catalog, streaming, library actions | Supported | Supported | Supported |
| Session storage | SecureStore | SecureStore | Tab-scoped `sessionStorage` |
| Glass surfaces and controls | Native Liquid Glass and SwiftUI | Frosted glass with live native backdrop blur; bundled icons | Frosted glass with CSS backdrop blur; bundled icons |
| Crimson previous/next/like remote controls | Native integration | Expo Audio foreground service and MediaSession adapter | Browser Media Session previous/next; favorite in player |
| Cover-pixel palette extraction | Native integration | Native bitmap sampling | Canvas sampling when image CORS permits |
| Circular tab artwork | Native integration | Shared image control | Shared image control |
| Persistent desktop player and keyboard shortcuts | — | — | Responsive sidebar, bottom player, seek and volume |
| Offline downloads | Native implementation | Native downloads; offline device playback validated | Unsupported |
| Voice search | OS speech recognition | Device/service dependent | Browser dependent |

Frosted surfaces retain the original light/dark background colors and corner shapes, with 80% background opacity and backdrop blur. They add no gradients, highlights, or borders. Navigation, mini players, Vault and preferences controls, header actions, and segmented selections use frosted backdrops; menus and queue sheets also blur the underlying scene. Ordinary content rows keep their existing styling. Performance Mode removes blur and uses opaque surfaces on every platform.

Android uses `expo-blur` with separate `BlurTargetView` layers, including the legacy RenderScript path for Android 7–11. This provides actual blur on the Moto G5 Plus; it costs more GPU/CPU work than the Android 12+ path. Targets exclude the controls that sample them to avoid recursive rendering. Web uses `backdrop-filter` and its WebKit counterpart through the same shared material component.

Basic audio functionality comes from `expo-audio`; the custom remote-control row above describes Crimson's additional native integration. Browser autoplay rules and tab suspension can limit web playback. Mobile web shares Android's bottom navigation, mini player, and player sheets. At widths of 960 px and above, web uses a persistent library sidebar, global search, a floating player, and an expanded player with integrated Up Next and Related panels. Desktop song menus open as compact anchored popups. Web icons use bundled SVG paths without icon-font loading.

Notifications are loaded from Audius inside the app. This repository does not implement push notification delivery. Reading notifications in Crimson updates a device-local seen cursor; it does not mark the notifications read in the Audius app. Unsupported destinations open Audius.

## Prerequisites

- Node.js 24 and npm; install the lockfile with `npm ci`.
- A registered Audius application and its public app key, configured using `.env.example`.
- iOS: macOS, Xcode, its command-line tools, and an appropriate signing setup for physical devices.
- Android: Android 7.0 (API 24) or newer. Build with JDK 21 and the Android SDK (compile/target SDK 36), including the NDK/CMake versions requested by Gradle. Android Studio can install these tools. Both 32-bit `armeabi-v7a` and 64-bit `arm64-v8a` phones are supported.
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

For a connected Android phone with USB debugging enabled and this Mac/computer authorized:

```bash
npm run android:device
# Metro-connected development build:
npm run android:device:dev
```

The release variant bundles JavaScript and artwork and runs without Metro. A Moto G5 Plus running 32-bit Android needs `armeabi-v7a`; an arm64-only APK cannot be installed on it. The generated project's release variant uses a development signing key for local device builds. Configure your own release signing before distributing through an app store.

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

## Native adapter maintenance

Android's adapter extends the existing Expo Audio foreground service and MediaSession. It does not create a second player. The plugin validates its source anchors and pins the supported `expo-audio` version; dependency upgrades need an adapter review before native generation succeeds. See [Android media adapter](../plugins/crimson-android-media/README.md).

Browser media controls are owned by the web player. Space toggles playback, arrows seek ten seconds, and Shift+arrows change tracks when focus is outside another interactive control. Palette extraction uses already loaded artwork in Data Saver mode and falls back when a browser blocks cross-origin pixel access.

## CI builds

The Quality workflow runs typechecking, lint, unit/integration tests, Android/web behavior tests, static web export, a standalone Android Release build for 32-bit and 64-bit ARM, and unsigned iOS Release compilation. Build jobs require no listener tokens or production signing secrets. The Android artifact uses development signing; builds without a configured public Audius key cannot complete login. Web and Android outputs are short-lived CI artifacts. Runtime device/browser results are recorded separately from compilation.

## Release validation

Use the [release validation checklist](RELIABILITY-RELEASE.md) for releases and add the actual device, browser, and result to [PLATFORM-VALIDATION.md](PLATFORM-VALIDATION.md). Automated Android/web regression tests run with `npm run test:platforms`; `npm test` includes them alongside the shared suites. Browser background suspension, device-specific speech services, audio interruptions, and new OS versions still require targeted runtime checks.
