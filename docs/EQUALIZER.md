# Equalizer engine

Crimson uses a 100 Hz low shelf, peaking filters at 300, 1,000 and 4,000 Hz, and a 10,000 Hz high shelf, with ±12 dB controls. Shelves use slope S = 1; middle bands use Q = √½. EQ starts disabled. The settings/preset model is `src/services/equalizer.ts`; the player hook prepares both decks before playback. Exact saved factory curves migrate to updated presets; custom gains remain unchanged.

The DSP follows the [W3C Audio EQ Cookbook](https://www.w3.org/TR/audio-eq-cookbook/). Preamp trims 0.2 dB for each dB of the largest boost, capped at 2 dB. A linked peak limiter after the filters handles actual overload: 0.98 sample ceiling, immediate attack, 30 ms hold, and 150 ms exponential release. All channels share the gain to preserve stereo balance. Flat/off bypasses processing once the 25 ms setting transition finishes. Strong sustained boosts can still cause gain reduction; there is no automatic makeup gain or added lookahead delay.

## iOS

`plugins/with-crimson-equalizer.js` patches Expo Audio 57.0.5's existing `MTAudioProcessingTap`. A permanent tap is prepared for each source, independently of spectrum events, Reduced Motion or performance settings. Off/on/preset changes update atomic DSP parameters; they never detach or install a tap. A bounded atomic snapshot avoids locks and allocation in the render callback. Float32 interleaved and planar buffers use independent channel histories, and only the frames returned by the source callback are processed.

Tap ownership tracks the actual `AVPlayerItem`. The two Expo item observers cannot install twice on the same item, old-item cleanup cannot clear the new item's mix, and source replacement resets filter history while preserving settings. Both crossfade decks receive the same curve. Sampling enablement controls event delivery and can be disabled while EQ stays active.

The native apply method reports unavailable builds, or a loaded item whose tap could not be installed. This pipeline is intended for Audius progressive audio and normal local files. It does not claim DSP support for protected or HLS media; unsupported processing formats bypass safely.

## Android

The permanent Media3 `CrimsonEqualizerProcessor` processes decoded PCM before the existing spectrum tee. Disabled EQ returns the original bytes while remaining an active processor, so toggling it never rebuilds the audio sink. Each deck has its own filter state. Flushes for seeks and new sources clear histories and retain the requested curve.

The sink explicitly uses PCM16, because Media3's float-output path bypasses custom audio processors. This means high-resolution local audio is rendered through a 16-bit processing path. No microphone permission or system/device-specific equalizer is required.

## Web

Every browser uses one graph per deck in `WebDeckGainControl`:

`Expo MediaElementSource → existing analyser (when enabled) → preamp → five BiquadFilters → limiter → crossfade gain → sleep gain → output`

The source node is shared with Expo's sampler; a second `MediaElementSource` is never created for the same media element. Spectrum toggles reconnect the existing graph, while preset updates retain its nodes. The AudioWorklet limiter uses the same envelope as native processing. Until it is ready, or if unavailable, conservative preamp compensation protects the output; this fallback can sound quieter. Crossfade gain and the sleep timer's scheduled audio-clock mute remain independent. Pending curve/deadline settings apply when a graph or replacement element is created. A failed graph restores single-deck playback and prevents crossfade overlap.

## Rebuilding and checking

The plugin is registered in Expo configuration, and `scripts/fix-expo-ios-paths.js` also invokes it at postinstall. It validates Expo Audio 57.0.5 and required upstream source anchors; review the adapters before upgrading Expo Audio. Android must retain `expo-audio` in `expo.autolinking.android.buildFromSource`.

Targeted checks:

```sh
node --test tests/equalizer-dsp.test.mjs tests/web-deck-gain.test.mjs tests/web-peak-limiter.test.mjs
clang -std=c11 -Wall -Werror -fsanitize=address,undefined -I plugins/crimson-equalizer tests/native/equalizer/equalizer-dsp.c -o /tmp/crimson-equalizer-dsp-test
/tmp/crimson-equalizer-dsp-test
# JAVA_HOME must point to JDK 17+; this runner uses the existing Gradle/SDK cache.
node scripts/test-android-audio-samples.mjs --equalizer
node scripts/test-android-audio-samples.mjs
```

The C and Kotlin tests measure output from generated PCM tones at every band, positive and negative gains, and multiple sample rates. They cover stereo isolation, exact disabled samples, source-reset persistence and native processor lifetime. Web tests verify routing and scheduled parameters; they do not substitute for a browser/device listening check. Full native Release builds are still required to validate the Expo bridge and containing app together.
