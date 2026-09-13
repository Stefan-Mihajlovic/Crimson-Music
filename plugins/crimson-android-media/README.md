# Android media adapter

`with-android-media-controls.js` extends the installed **expo-audio 57.0.5** sources during Android prebuild. This directory contains the canonical Kotlin sources for remote commands, artwork palettes and PCM sampling. Generated Android and dependency directories remain ignored.

`package.json` includes `expo-audio` in `expo.autolinking.android.buildFromSource`. This is required: Expo 57 otherwise links its prebuilt audio AAR and ignores local source patches. The plugin validates this setting. Expo Blur also builds from source for its adapter; other Expo modules keep their prebuilt optimization.

Expo's existing `AudioControlsService`, `MediaSession`, and `AudioPlayer` retain playback, seeking, audio focus, and foreground-service ownership. `MetadataInjectingPlayer` advertises the queue directions available in Crimson and forwards the corresponding previous/next commands through Expo module events. Availability updates use `Player.Listener.onAvailableCommandsChanged`; artwork updates still use Expo's existing metadata wrapper. The adapter also exposes the favorite action, including older Android notification actions. Queue actions need Crimson's JavaScript runtime, as do in-app queue changes; it does not add a separate native queue or background headless runtime.

The palette extractor uses a small bitmap on an IO coroutine, a bounded read, three distinct quantized colors, and a bounded persistent cache. Cache-only requests may decode an already cached cover but never start a network request.

`CrimsonAudioSampleSink` installs Media3's `TeeAudioProcessor` in this same player's default audio sink. It observes decoded playback PCM without recording the microphone or requesting `RECORD_AUDIO`. The tee forwards the audio unchanged; `CrimsonPcmSamples` uses absolute reads that preserve buffer contents, position, limit and byte order. Capture is capped at 20 packets per second, 512 sequential frames and two channels, with only one pending main-looper callback. The existing `audioSampleUpdate` event remains `{ channels: [{ frames: number[] }], timestamp: number }`, using normalized signed samples and Expo Android's existing millisecond timestamp. Events require active playback; disabling sampling, flushing a source or releasing the player cancels pending packets.

The default Media3 1.9.0 integer pipeline converts input to 16-bit PCM before custom processors. Float output and offload remain at Expo's existing disabled defaults. Future encoded passthrough/offload or float-output configurations can bypass this processor; unsupported PCM formats are ignored instead of emitting invalid samples. Sampling currently precedes Media3's speed/silence processors and Android's output volume, so it represents decoded music rather than final speaker loudness. Other legitimate microphone permissions, such as voice search, are unchanged.

After changes, regenerate and compile with your Android SDK/JDK configured:

```sh
npx expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

Expo Go and existing Android binaries do not contain these methods; rebuild the development app after adopting this plugin. An old binary reports the missing remote adapter once and keeps Expo's basic play/pause working.

The persistent patch can also be applied before an incremental native build without a full prebuild:

```sh
node -e "require('./plugins/with-android-media-controls').patchAndroidMedia(process.cwd())"
node --test tests/android-audio-plugin.test.mjs
node scripts/test-android-audio-samples.mjs
```

The standalone native check requires `JAVA_HOME` (or Java on PATH), an Android SDK (`ANDROID_HOME`, `ANDROID_SDK_ROOT`, or this project's `.build/android-toolchain/sdk`) and dependencies cached by an earlier Android build. It compiles the production Kotlin against Media3 1.9.0 and checks actual PCM decoding, bounds, buffer preservation, throttling and lifecycle cancellation using a deterministic main-looper scheduler. It does not start Gradle or prove hardware playback timing; verify playback and the equalizer on a physical Android device after installing a fresh build, including a device with microphone permission denied.

When upgrading Expo Audio, review the five patched source files and update the exact version guard. All expected anchors are validated before dependency files are written. Patches are idempotent. If editing an already-applied source transform, reinstall the pinned dependency before prebuild so the patch is applied to clean upstream sources. Canonical helper edits are copied on every invocation.

The 57.0.4 → 57.0.5 upgrade was checked against the published npm packages: Android and iOS sources are unchanged; only Android module version metadata changed. The existing media adapter therefore requires no Kotlin changes for this upgrade.

API references: [Media3 ForwardingPlayer](https://github.com/androidx/media/blob/1.9.0/libraries/common/src/main/java/androidx/media3/common/ForwardingPlayer.java), [Player commands](https://github.com/androidx/media/blob/1.9.0/libraries/common/src/main/java/androidx/media3/common/Player.java), [session command buttons](https://github.com/androidx/media/blob/1.9.0/libraries/session/src/main/java/androidx/media3/session/CommandButton.java).

PCM references: [TeeAudioProcessor and its read-only buffer sink](https://github.com/androidx/media/blob/1.9.0/libraries/exoplayer/src/main/java/androidx/media3/exoplayer/audio/TeeAudioProcessor.java), [DefaultRenderersFactory audio-sink hook](https://github.com/androidx/media/blob/1.9.0/libraries/exoplayer/src/main/java/androidx/media3/exoplayer/DefaultRenderersFactory.java), [DefaultAudioSink processor order and PCM restrictions](https://github.com/androidx/media/blob/1.9.0/libraries/exoplayer/src/main/java/androidx/media3/exoplayer/audio/DefaultAudioSink.java).
