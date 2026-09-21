# Home-screen widgets

Crimson provides small, medium, and large home-screen widgets on iOS and Android. They use native WidgetKit/SwiftUI and Android AppWidgetProvider/RemoteViews. Web builds do not register mobile widgets.

| Size | Contents and actions |
| --- | --- |
| Small | Last/current track artwork, title, and artist. Tap to open Crimson and resume. |
| Medium | Track artwork and details, explicit play/pause and next actions, Favorites, and Daily Mix. |
| Large | Track details, previous/next actions, next-track title, Favorites, Daily/Weekly/Monthly Mixes, Local Music, and recently played. |

Controls open Crimson and perform the selected action. The `/widget` route waits for account and player restoration and uses explicit resume/pause commands so stale snapshots cannot invert playback. Playback actions return to the existing tab host and expand its shared draggable player. Collection shortcuts reuse screens inside their tab stacks. Favorites and mix shortcuts start their collections; Local Music and recently played open for browsing. Widgets do not control the React Native player inside a separate process.

Both platforms use Crimson's dark purple surfaces, violet accent (`#965CFF`), and the existing `assets/images/icon.png` brand mark. The logo is copied unchanged into the native widget resources. Headings and hints use sentence case.

## Adding a widget

- **iPhone:** Touch and hold the Home Screen, choose Edit → Add Widget, search for Crimson Music, then choose a size. Open Crimson once after installing a new native build if it has not appeared in the gallery.
- **Android:** Touch and hold the Home Screen, choose Widgets, then choose Crimson Small, Medium, or Large. Launcher wording and available dimensions vary. Resize the widget using the launcher's handles.

## State and privacy

`WidgetSync`, mounted inside the auth, download, and player providers, publishes metadata when the track or playback controls change. It waits for playback restoration before replacing the saved snapshot. Native code persists a bounded display snapshot and one thumbnail. The extension has no Audius token, signed stream URL, listening history, or full queue.

Signing out publishes an empty snapshot and removes the cached artwork. Thumbnail downloads do not block playback or text updates. Failed artwork requests leave a music-note placeholder. Widgets request refreshes on track/control changes rather than every playback-position tick. iOS decides when requested refreshes are delivered, so widgets display the last supplied state rather than a live progress clock. Android updates installed widget instances directly.

## Native build integration

The `./plugins/with-crimson-widgets` Expo config plugin owns all generated integration. Keep canonical files in `plugins/crimson-widgets`; do not maintain widget code by editing ignored native folders.

For iOS it:

1. Adds the `CrimsonWidgets` main-app native bridge and a separate `CrimsonWidgets.appex` target.
2. Embeds the extension and makes the main app depend on it.
3. Sets the extension bundle ID to `<ios.bundleIdentifier>.widgets`.
4. Enables App Groups for both targets and uses `group.<ios.bundleIdentifier>` for their shared container.
5. Inherits development team, version/build numbers, supported devices, and deployment target from the app. Widget UI supports iOS 16.4 and later, using container backgrounds on iOS 17+.

Use the existing `IOS_APPLE_TEAM_ID` / `IOS_BUNDLE_IDENTIFIER` configuration when building a fork. The plugin preserves the app's existing signing configuration and derives the extension's team from the configured team or the existing app target. Both app identifiers must belong to the signing team and have access to the shared App Group. Xcode automatic signing with provisioning updates is needed the first time the capability/extension is added.

In Xcode, select the **main CrimsonMusic target** → Signing & Capabilities and select its development team as well as the extension's team. Confirm the same App Group is checked for both targets. A command-line team override alone may leave Xcode's existing main-app registration with an empty group list. If the extension signs but the main app reports an App Groups mismatch, reselecting the existing team on the main target lets Xcode associate the group and refresh that app's profile. A cached old main-app provisioning profile without the group must be refreshed; removing the entitlement would break shared widget state.

For Android the plugin installs one native module package, three widget receivers, launcher metadata, layouts, and drawables. Widget taps use immutable, explicit activity `PendingIntent`s, avoiding broadcast/service launch trampolines. It requires no extra permission or background service.

## Validation

- `node --test tests/widgets-plugin.test.mjs` validates repeated generation, extension embedding, signing/capabilities, source paths, all Android layouts, and native package registration.
- `node --test tests/widget-navigation.test.mjs` validates real-router reset behavior, removal of legacy stacked players, preservation of tab/route keys, repeated collection reuse, and cold-launch player presentation.
- `npx jest tests/widgets.integration.test.js --runInBand` validates restore-before-resume, exactly-once dispatch, stale play/pause actions, real Favorites/next playback actions, repeated warm launches, mix routing, offline local/downloaded Favorites, and metadata removal on sign-out.
- Build the native iOS app (including the extension) and Android app after prebuild. JavaScript-only updates cannot add widgets to an existing binary.

On a device, add each size, play a track, background Crimson, and confirm the saved artwork/title. Test pause/resume, next, Favorites, and each mix shortcut with the app both running and terminated. Confirm an offline Favorites action uses downloaded tracks, and signing out clears visible personal music.

Primary platform references: [Apple: Creating a widget extension](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension), [Apple: Keeping a widget up to date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date), [Android: Create a basic widget](https://developer.android.com/develop/ui/views/appwidgets), [Android: Widget sizing](https://developer.android.com/design/ui/mobile/guides/widgets/sizing).
