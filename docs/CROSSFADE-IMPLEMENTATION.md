# Crossfade engine

The player maintains two Expo Audio decks behind a stable facade. The next track
is loaded muted before its transition window. The overlap uses the incoming
track's media time for linear gain, capped to half of either song's duration.
Pause, buffering, seek, queue changes and account cleanup preserve or cancel the
transition as appropriate. Remote native pause/resume is observed directly on the
active deck and mirrored to the outgoing tail. An incoming buffer stall keeps the
outgoing song audible while the fade progression waits. Short tracks retry preload
after an earlier overlap ends. Crossfade remains off by default; enabling it starts
with three seconds. The original six-second default migrates to three, while new
explicit duration choices are retained.

Spectrum taps are enabled on both decks before playback/preloading and remain
attached during the handoff. Installing or removing an iOS tap mutates the
AVPlayerItem audio mix, so doing it after starting the incoming song can stall
both audible decks. The facade filters sample events to the active deck without
reconfiguring the audio mix at the transition boundary.

Native iOS and Android use the Expo player volume API. Web uses a Web Audio
gain graph, including iOS browsers that ignore HTMLAudioElement.volume.
The adapter reuses Expo's shared AudioContext and existing
MediaElementAudioSourceNode, preserves the spectrum analyser, and restores its
output route after source replacements and spectrum toggles. A running gain graph
on both decks is required before overlapping. Graph failure mutes standby audio
and falls back to single-track playback. Play/seek gestures resume the context
synchronously, before stream resolution. Browser media requests use anonymous
CORS so Audius audio can enter Web Audio.

`web-deck-gain.ts` inspects Expo's JS-private `media`, `sourceNode` and `analyser`
fields. This adapter was audited against **expo-audio 57.0.5**. The version guard
in `tests/web-deck-gain.test.mjs` intentionally fails after an Expo Audio upgrade;
review the internal fields, shared context and sampling/replacement behavior
before updating it.

Tests cover gain progression, pause/resume, native remote controls, buffering,
seeking, stale preloads, volume updates, sampling handoff, gain graph failures,
source replacement, graph recovery and cleanup. Real-device listening remains
necessary to assess transition smoothness and background timer scheduling across
OS versions, headphones and output routes.
