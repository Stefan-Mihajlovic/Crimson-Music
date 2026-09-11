# Android media adapter

`with-android-media-controls.js` extends the installed **expo-audio 57.0.5** sources during Android prebuild. `CrimsonRemoteCommands.kt` and `CrimsonArtworkPalette.kt` are the canonical added sources. Generated Android and dependency directories remain ignored.

`package.json` includes `expo-audio` in `expo.autolinking.android.buildFromSource`. This is required: Expo 57 otherwise links its prebuilt audio AAR and ignores local source patches. The plugin validates this setting. Expo Blur also builds from source for its adapter; other Expo modules keep their prebuilt optimization.

Expo's existing `AudioControlsService`, `MediaSession`, and `AudioPlayer` retain playback, seeking, audio focus, and foreground-service ownership. `MetadataInjectingPlayer` advertises the queue directions available in Crimson and forwards the corresponding previous/next commands through Expo module events. Availability updates use `Player.Listener.onAvailableCommandsChanged`; artwork updates still use Expo's existing metadata wrapper. The adapter also exposes the favorite action, including older Android notification actions. Queue actions need Crimson's JavaScript runtime, as do in-app queue changes; it does not add a separate native queue or background headless runtime.

The palette extractor uses a small bitmap on an IO coroutine, a bounded read, three distinct quantized colors, and a bounded persistent cache. Cache-only requests may decode an already cached cover but never start a network request.

After changes, regenerate and compile with your Android SDK/JDK configured:

```sh
npx expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

Expo Go and existing Android binaries do not contain these methods; rebuild the development app after adopting this plugin. An old binary reports the missing remote adapter once and keeps Expo's basic play/pause working.

When upgrading Expo Audio, review the four patched source files and update the exact version guard. All expected anchors are validated before dependency files are written. Patches are idempotent. If editing the patch itself after it has already run, reinstall the pinned dependency before prebuild so the patch is applied to clean upstream sources.

The 57.0.4 → 57.0.5 upgrade was checked against the published npm packages: Android and iOS sources are unchanged; only Android module version metadata changed. The existing media adapter therefore requires no Kotlin changes for this upgrade.

API references: [Media3 ForwardingPlayer](https://github.com/androidx/media/blob/1.9.0/libraries/common/src/main/java/androidx/media3/common/ForwardingPlayer.java), [Player commands](https://github.com/androidx/media/blob/1.9.0/libraries/common/src/main/java/androidx/media3/common/Player.java), [session command buttons](https://github.com/androidx/media/blob/1.9.0/libraries/session/src/main/java/androidx/media3/session/CommandButton.java).
