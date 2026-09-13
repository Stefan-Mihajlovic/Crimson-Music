# Android and web validation

## 2026-09-11

This record covers the Android/web readiness changes based on `06c288c`. It separates checks performed on real runtimes from automated regression coverage. It is not a claim that every Android device or browser has been tested.

### Environments

- Motorola Moto G (5) Plus, Android 8.1.0 / API 27, 32-bit `armeabi-v7a`. Installed a standalone Release APK over USB; JavaScript and artwork are bundled, so Metro is not required.
- Microsoft Edge on macOS, running the local web application at `http://localhost:8081`. Login was completed through Audius in the browser.
- Local build tools: Node 24, JDK 21, Android SDK 36, NDK 27.1.12297006. CI additionally compiles 64-bit ARM.

### Runtime results

| Flow | Android | Web |
| --- | --- | --- |
| Audius sign-in and account data | Passed; account restored after force-stop/relaunch and APK update | Passed; OAuth, Home data and same-tab reload |
| Catalog and library | Home/followed artists loaded | Search, artist detail, library and eight Favorites loaded |
| Streaming | Passed; playback position advances, artwork palette visible | Passed; browser reports audio playing and timeline advances |
| Player controls | Play/pause and system Next passed; Back dismisses the full player | Play/pause, queue insertion and menu-to-artist navigation passed |
| Offline listening | Saved a track, disabled Wi-Fi and mobile data, force-stopped and relaunched, then played it successfully | Unsupported; download buttons/filter hidden |
| Background media service | With the app backgrounded and network disabled, system Play resumed at 40 s and system Pause stopped at 174 s, with no playback error | Media Session and keyboard command behavior covered by automated tests; browser suspension is still browser-controlled |
| Navigation and presentation | Solid tab bar, circular account artwork, bundled icons, player collapse and bottom system-bar clearance checked | Search/library navigation, responsive desktop controls and visible action buttons checked |

Wi-Fi and mobile data were restored after the offline check. The Android build uses a development signing key for device installation, not a Play Store release identity. No production web deployment was performed in this pass.

The frosted-material follow-up was checked in Edge and in a fresh standalone APK on the same Motorola. Original colors and shapes are retained; only the surface alpha and backdrop blur change. The Android adapter fixes the observed invalid RenderScript context and shares cropped captures for legacy devices. Blur remains more expensive on this Android 8.1 phone than opaque Performance Mode; these checks do not establish a 60 fps guarantee. The expanded player opens and the updated APK retains the signed-in session.

### Defects fixed during runtime validation

- Android/web shared controls previously requested iOS-only symbols. They now use bundled Ionicons, including an identifiable repeat-one state and accessible status labels. iOS continues using SF Symbols.
- Android used glass surfaces with no available native glass implementation. The player and navigation now use native frosted backdrops (opaque in Performance Mode), with space above the system navigation bar.
- Android Back now collapses the expanded player before leaving the screen. Detail headers reserve layout space on Android/web instead of relying on iOS automatic scroll insets; the offline banner no longer covers its own page header.
- Browser OAuth failed because the session client invoked an unbound browser `fetch` with the wrong receiver. The default transport is now bound to `globalThis`.
- Browser navigation failed on the Expo Router slot's array-style input. Its direct child now receives a flattened style.
- React Native Web's no-op alerts hid failures and confirmation actions. Web alerts now use queued accessible browser dialogs with explicit cancellation.
- Voice-search permission errors and unmounts during permission prompts are handled; unavailable-recognizer instructions match the platform.

### Automated coverage and builds

- `npm run check`: TypeScript and ESLint.
- `npm test`: 36 unit tests, 93 shared/iOS integration tests, 13 Android/web regression tests.
- Android/web regression tests cover actual platform module resolution, bundled control glyphs, voice permission failures/unmount, browser transport binding, browser alert actions/cancellation/escaping, Media Session/keyboard controls and cleanup, attached Android backdrop targets without self-capture, CSS blur with the original palette, and opaque Performance Mode controls.
- Standalone Android Release APK compiled and installed on the Motorola. Static web export compiled. CI runs the platform regression suites, static web export, 32/64-bit ARM standalone Android compilation, and unsigned iOS compilation.

### Remaining release matrix

Speech recognition depends on an installed recognition service and browser support; spoken transcription was not validated in this pass. Bluetooth/headset behavior, incoming calls/audio interruptions, long-duration background playback, aggressive vendor battery policies, modern Android versions, TalkBack, Safari/Firefox, and hosted-origin OAuth need their own runtime results before claiming validation for those environments. Shared library-write and account-isolation regressions are covered by the existing tests; live playlist creation/deletion was not repeated against the listener's account.

Offline downloads remain mobile-only, Liquid Glass remains iOS-only, with frosted glass on Android/web, and browser artwork sampling can fall back when an image host denies CORS. See [platform support](PLATFORMS.md) and the [release checklist](RELIABILITY-RELEASE.md).

### Responsive web redesign follow-up

Checked the redesigned application in Microsoft Edge on macOS at desktop size and in a 390 × 844 mobile viewport using browser device emulation. Mobile web retains Android's bottom navigation, floating mini player, expanded player, and bottom sheets. Desktop now keeps the library and search available beside the content, presents compact track lists and collection headers, and uses a floating playback bar. The expanded player contains Up Next and Related in its own side panel. Icons render from bundled SVG paths.

Runtime checks passed for Home, Search results, Library, Favorites, artist details, playback with an advancing timeline, pause, expanded player, Related results, and song menus. Desktop Escape closes the song popup while keeping the player open and returns focus to the menu trigger. Navigating from that menu to the artist dismisses the player and restores the floating bar. Mobile navigation and both song and player-details sheets were visually checked in the emulated viewport; this does not claim a physical mobile-browser run.

`npm run check`, `npm test` (36 unit, 93 integration, and 30 Android/web tests), and `npx expo export --platform web` passed after the redesign. Added regression coverage includes responsive shell navigation and account isolation, queue and Related interactions, track/menu button separation, viewport popups, focus restoration, and dismissal of only the top sheet. The static output is in `dist/`; no production deployment was performed.

The refinement pass adds content scrolling behind the translucent desktop player, tighter mobile player/navigation spacing, pointer-driven player expansion/collapse and sheet dismissal, smaller menus animating from their trigger, roomier web detail headers, purple scrollbars, and desktop history/notifications beside the profile button. Desktop Music preferences now has ordinary genre checkboxes, discovery radio choices, and Save/Cancel controls. Decorative popup/Vault labels were removed and player/collection labels use sentence case.

Edge device emulation verified dragging the mini player upward to open, pulling the expanded artwork downward to close, and pulling the song-sheet handle downward to dismiss. Desktop verification covered the smaller anchored menu, blur with content beneath the player, clicking the search icon to focus its input, and the preferences form. Regression coverage also checks canceled drags, controls/scrolling excluded from drag recognition, preference validation/save/retry, and artwork failover. Final checks passed with 36 unit, 93 integration, and 48 Android/web tests plus the static web export.

The reported anonymous `startTime` exception was traced through Edge's Sources panel to its injected performance-metrics script: the `INP` callback reads `t.entries[0].startTime` and configures `window.devToolsReportSoftNavs`. This is separate from Crimson's application bundle. Failed Audius artwork requests now try explicit mirror origins and then a bundled placeholder, with bounded retries and a five-minute failed-URL cache; the browser can still log the initial network failure from an unavailable content node. Web animation driver/easing and navigation-focus issues were corrected at their application sources.

The desktop layout polish keeps one persistent toolbar search input across Home, Search, and Library, with query updates and clearing shared with Search results. Desktop main-page titles and their compact scroll overlays are removed; mobile and Account headers remain. Library search no longer animates its layout or changes width on focus. Popup close buttons float over the content instead of reserving a header strip, so top and side insets match. The mini player's favorite button sits beside Up Next and equal outer columns center the seek/transport controls. Expanded-player artwork, title, seek, transport, and volume share one width.

Edge runtime checks confirmed the persistent search field and live ZYRA results, title-free main pages, compact artist-popup spacing, centered mini controls, and artwork-aligned expanded controls. TypeScript, ESLint, all 183 tests (36 unit, 96 integration, 51 Android/web), and the static web export passed. Focused tests also cover the reserved Library cancel slot remaining invisible and absent from accessibility navigation when inactive, even with global disabled-button styles. Final static output remains in `dist/`.

Before the GitHub submission, Expo SDK 57 patch dependencies were aligned with `expo-doctor` (21/21 checks passed). Published-package comparisons confirmed unchanged native sources in expo-audio 57.0.5 and expo-blur 57.0.3; adapter version guards were updated, isolated patch checks passed, and Android prebuild applied both adapters successfully. Player animation timers and opening frames now belong to a session and are canceled when their route loses focus or unmounts, preventing a stale completion from navigating back twice. The updated suite passed 190 tests (36 unit, 96 integration, 58 Android/web), with TypeScript, ESLint, and a fresh static web export also passing. Fresh native compilation is delegated to the PR's Android and iOS CI jobs; previous physical-device results above describe the earlier tested builds.

## 2026-09-13 — Profile editing and shared visual updates

The current pass covers the in-app display-name/photo editor and the preceding Sonata icon, violet accents, Vault controls, Favorites artwork centering/pulse, sentence-case labels, bare main-header icons, full-width white login button, and recap layout changes. The platform audit found and fixed one web-specific recap issue: React Native Web ignores `snapToOffsets`, so the deck now uses CSS snapping with the first card at the page gutter and subsequent cards centered. Two web DOM regressions check those positions at 393px and 1440px widths.

- TypeScript, ESLint, and all 237 tests passed: 41 unit, 136 integration, and 60 Android/web platform tests. Platform tests include mocked dependencies and do not substitute for device UI checks.
- A fresh static web export and signed iOS Release build passed. The iOS build was installed wirelessly and launched on the paired iPhone 15 Pro.
- Android-only prebuild and a fresh standalone Release APK compilation passed for both `armeabi-v7a` and `arm64-v8a`; both native-library directories were confirmed in the resulting APK. The first attempt stopped at an unconfigured Sentry source-map upload. The successful local retry used `SENTRY_DISABLE_AUTO_UPLOAD=true`, without changing project configuration. The build log is `.build/profile-editing/build-android.log`; the APK is `android/app/build/outputs/apk/release/app-release.apk`.

No Android device or emulator was connected during this pass, so the physical Android results above apply to their earlier builds. No live changes were submitted to a public Audius profile during validation, and no production web deployment was performed.

The photo-upload follow-up corrected a runtime gap missed by the earlier mocked FormData tests: Expo 57's fetch serializer rejects the legacy native `{ uri, name, type }` upload object. Native uploads now use `expo-file-system`'s `File` with readable bytes. Four regressions exercise the installed Expo FormData patch and real multipart serializer, including the production upload path for iOS and Android; their file-system bridge is still substituted in tests. All 245 tests passed (41 unit, 144 integration, 60 Android/web), and a fresh 32/64-bit ARM Release APK compiled successfully with local Sentry uploads disabled. An anonymous live upload of the bundled generic favicon, encoded through that production path and serializer, returned HTTP 200 with processing status `done`. This verifies multipart acceptance by Audius storage; it does not verify the physical native file bridge or an end-to-end Save to an actual Audius profile. Logs and probe artifacts are under `.build/profile-upload-fix/`.

### Welcome, required preferences, and refresh placement follow-up

Welcome now shows continuously scrolling artwork columns with bundled covers available before network artwork arrives. Motion stops when the screen loses focus, the app is backgrounded, or reduced-motion/Performance Mode is enabled. The moving cover grid was visually checked in the browser at phone and desktop sizes. Account's footer uses the requested brand text, version, and copyright. Sign-in now requires at least two valid, distinct saved music categories before entering the app; existing valid saved preferences remain accepted, and editing preferences remains separate from first-time setup.

Home's native refresh indicator now follows the top safe-area inset, matching the screen's manually padded content without adding header spacing. The installed React Native 0.86 iOS Fabric implementation was inspected to confirm that `progressViewOffset` moves `UIRefreshControl`; Android receives the native offset and shared accent, while web positioning remains unchanged. Focused regressions cover Dynamic Island and older-iPhone insets, Android insets, inset changes, and the unchanged web behavior. This is source and automated validation, not a physical-device visual confirmation of refresh placement.

TypeScript, ESLint, and all 298 tests passed (41 unit, 196 integration, 61 Android/web). A fresh standalone Android Release APK compiled for both 32-bit and 64-bit ARM with task-local Sentry uploads disabled; `.build/welcome-refresh/build-android.log` records the result. The final static web export passed and the welcome screen was checked at 393 × 852 and 1440 × 900 browser viewports. A signed iOS Release build passed, was installed wirelessly on the paired iPhone 15 Pro, and launched successfully; build, installation, and launch logs are under `.build/welcome-refresh/`. No physical Android device was used for this follow-up. Browser viewport checks do not imply a physical mobile-browser run, and required onboarding was verified with integration tests without clearing the listener's saved preferences.

### Home spotlight and discovery follow-up

Home now has a responsive artist spotlight with a portrait, biography, playback, profile navigation, and menu actions, followed by Underground gems, Most shared this week, and genre shortcuts. The optional shelves load independently of the main feed, remove already displayed tracks, and preserve account/preference isolation and offline snapshots. Spotlight playback uses that artist's playable tracks; absent artists or failed optional requests leave the remaining content usable.

The actual spotlight and discovery components were visually checked in a standalone browser harness at 393 × 852 and 1440 × 1000, using public Audius sample data. Play and genre callbacks were exercised through the harness status display. This harness preserves the source components, rows, and icons, but substitutes account/player/router providers and native image/gradient adapters; it is not authenticated end-to-end navigation or real playback validation.

TypeScript, ESLint, static web export, iOS Release compilation, and fresh Android Release compilation for both ARM architectures passed. The iOS build was installed wirelessly and launched on the paired iPhone 15 Pro. Android used task-local `SENTRY_DISABLE_AUTO_UPLOAD=true`; its log and the iOS build/install/launch logs are under `.build/home-discovery/`. The full suite passed 328 tests, then an additional absent-artist/error regression passed in a focused nine-test rerun, bringing passing coverage to 329 tests (41 unit, 227 integration, 61 Android/web). No physical Android run was performed for this follow-up.

### Home refinement and playback spectrum on both phones

Home's additional discovery content now keeps Underground gems as ordinary track rows; Most shared and the extra genre shortcuts were removed. Playback markers use four more visible frequency bands derived from decoded audio, with bounded analysis and pause/background/reduced-motion handling. Android's media adapter now samples the existing ExoPlayer PCM path using `TeeAudioProcessor`, replacing the microphone-permission-dependent Visualizer path. Seventeen standalone checks passed for the production Kotlin parser/sink against Media3 APIs, covering sample decoding, unchanged playback buffers, 512-frame/stereo limits, 20Hz throttling, and dispatch/cancellation behavior. These checks do not claim visual confirmation of live spectrum bars on the physical phone.

TypeScript, ESLint, all 342 tests (48 unit, 233 integration, 61 Android/web), and the static web export passed. The exported application was checked through the local browser preview at `http://localhost:8081`; no production hosting deployment was performed. A signed iOS Release build was installed wirelessly and launched on the iPhone 15 Pro.

A fresh Android Release APK compiled for both ARM architectures with task-local Sentry uploads disabled. Its signing certificate matched the existing installation on the connected Motorola Moto G (5) Plus (Android 8.1/API 27, 32-bit ARM). The APK was installed with replacement mode, retaining app data and the original first-install timestamp, then `.MainActivity` launched successfully. The app process remained alive, and its captured startup logs contained no fatal exception, JavaScript error, or ANR matches. Build, installation, launch, and process logs for this pass are under `.build/home-refinement/`. This device pass verifies installation and startup; it does not repeat the earlier manual playback/offline matrix.

During PR validation, GitHub's default Xcode 26.6 failed to compile the Icon Composer 2.0 Sonata document, although local Xcode 27 builds passed. The workflow now selects the supported `xcode-27` runner and checks actual icon compilation before CocoaPods. The isolated icon compilation was reproduced successfully with Xcode 27; the deployment target and selected layered design are unchanged.
