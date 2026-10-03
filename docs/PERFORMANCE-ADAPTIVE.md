# Performance and adaptive layout pass — 3 October 2026

## Changes

- **Web login:** the hosted build was missing its public Audius OAuth client identifier. The Netlify build now supplies the existing public app identity and validates configuration before export. Forks should override that identifier with their own registered Audius application. No private key or listener token is included in this configuration.
- **OAuth continuity:** browser login uses a same-tab redirect with a short-lived PKCE transaction in sessionStorage. Native transactions use SecureStore, allowing callback recovery after the OS recreates the process. Callbacks verify the state, destination, and ten-minute lifetime. Duplicate callbacks share an exchange, logout invalidates pending authorization, and transient profile GET failures can retry without replaying a one-time token exchange.
- **Initial web loading:** web routes load in separate bundles, and optional Sentry reporting loads asynchronously. An intermediate export reduced the initial welcome-page JavaScript from approximately **4.3 MB to 3.02 MB** (about **30%**, uncompressed script bytes). This is a bundle-size comparison, not a claim about connection speed, frame rate, or device battery life.
- **Rendering:** welcome artwork motion uses browser CSS transforms instead of one JavaScript animation loop per column. It still pauses for background tabs, unfocused routes, Reduce Motion, and Performance Mode. The desktop library uses browser content visibility for offscreen rows.
- **Requests:** concurrent identical authenticated GETs share their request and JSON decoding. Keys include the session revision; writes invalidate in-flight sharing. Completed responses are not retained here, so library edits still request fresh data.
- **Desktop:** the sidebar supports pointer and keyboard resizing (220–480 px, constrained by the remaining content width), a 76 px collapsed rail, and remembered width. Its logo becomes the collapse/expand control on hover or keyboard focus. The bottom player retains its original floating placement and translucent blur, with less rounded corners, a seek bar along its top edge, and centered transport controls. It follows the sidebar width. Route, search input, library, and playback state stay mounted. Cards, controls, search focus, and page navigation receive short transitions that respect motion settings.
- **Player and popup refinements:** native player transitions resize a rounded clipping mask with fixed-size, unscaled content, removing the scale/inverse-scale resampling path for text and controls. Desktop player entry and guarded exit use vertical slide animations, including Back and Escape; Reduce Motion skips them. Overlay URLs no longer reset the page-animation baseline. Desktop library search clears inline without an external cancel slot.
- **Adaptive mobile:** orientation is unlocked and Android explicitly supports resizing. Compact portrait behavior remains; wider or square player windows gain artwork and control panes, plus a virtualized Up Next panel when there is enough height. Short welcome windows can scroll. Main headers and browse content account for asymmetric safe areas; category grids use even column counts.
- **Android folding:** an activity-scoped Jetpack WindowManager 1.5.1 adapter reports actual folding bounds. The player and its drag artwork share one subscription and geometry. Separating vertical folds get a book layout; horizontal folds get artwork above and scrollable controls below, leaving clearance around the fold. No model-name heuristics are used.

## Review scope

Reviewed root/provider startup, session persistence and refresh, API/cache lifetimes, home/search/library loading, artwork selection and welcome animation, desktop navigation and player controls, native player geometry, and generated platform/build configuration. Existing player status/spectrum contexts already isolate high-frequency progress updates, and existing request caches, image fallback/cache handling, and virtualized queue controls were retained.

## Validation and boundaries

- Actual Edge OAuth round-trip succeeded with the existing Audius account; its library loaded. Desktop collapse/expand, Home/Search/Library navigation, and the expanded player were exercised. Audio playback advanced from 0:07 to 1:45 and was then paused.
- TypeScript, lint, shared tests, Android/web tests, static export, signed iOS Release, and Android ARM64 Release are checked as part of this pass. Build logs live in the ignored `.build/optimization-*` files.
- The signed Release was installed on the connected iPhone 15 Pro. Its app and widget profiles are valid through 10 October 2026 and local code-signature verification passes. After the follow-up refinements, the latest Release installed and launched successfully on the device. Sharpness throughout an interactive gesture still needs a visual check on the physical display.
- Follow-up checks: 115 unit, 409 integration, and 92 platform tests passed; TypeScript/lint, web export, and iOS Release passed. Regression coverage includes popup return without page animation, pointer/keyboard sidebar resizing, inline search clearing, animated player exit, reduced motion, and unmount cleanup. Edge interaction checks covered the sidebar, search, menus, and full player. Logs are in `.build/refinements-*`.
- The local preview is at `http://localhost:8081`. The Netlify configuration change takes effect on the next deployment; local export alone does not update the public website.
- iPhone Duo's new reserved-region APIs require Xcode/iOS 27.1. This machine has Xcode 27.0. This pass uses responsive window geometry, safe areas, and existing system navigation on iOS; it does **not** claim reserved-region integration or physical Duo validation.
- Android's fold adapter compiles, and layout geometry has automated book/tabletop/asymmetric-inset checks. Actual hinge transitions, display handoff, system bar relocation, and touch targets still need hardware/emulator validation. Fold-aware positioning currently applies to the expanded player; other screens use responsive grids and safe areas.
- No end-to-end FPS, memory, thermal, or battery benchmark was performed. Successful compilation does not establish flawless behavior on every foldable.

## Platform references

- [Apple: Designing for iPhone Duo](https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo)
- [Apple: Prepare your app for iPhone Duo](https://developer.apple.com/videos/play/tech-talks/111461/)
- [Google: Learn about foldables](https://developer.android.com/develop/adaptive-apps/guides/foldables/learn-about-foldables)
- [Google: WindowManager releases](https://developer.android.com/jetpack/androidx/releases/window)
- [Audius: Log in with Audius](https://docs.audius.co/developers/guides/log-in-with-audius/)
- [Expo SDK 57: web bundle splitting](https://docs.expo.dev/versions/v57.0.0/config/metro/)
