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
