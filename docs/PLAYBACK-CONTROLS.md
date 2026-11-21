# Playback controls

Settings groups sound processing separately from speed, transitions and sleep;
visual effects sit with appearance, and Data Saver sits with downloads.

Speed runs from 0.5× to 2× in 0.05 steps. Preserve pitch uses high-quality pitch
correction; turning it off lets pitch follow speed. Reset returns to 1×. Both
persistent decks receive these preferences, including the preloaded next track.

Loudness normalization currently runs in the iOS audio tap alongside the equalizer.
It measures a three-second streaming RMS envelope, gates silence, targets -18 dBFS
RMS, limits gain to -20…+6 dB, and applies a linked 0.98 peak ceiling. This is
adaptive streaming normalization, not EBU R128 integrated LUFS measurement or
album normalization. State resets for each source; gain changes are smoothed.
Native processing continues with JavaScript suspended. It requires a source that
supports AVPlayer PCM taps, as does the equalizer. Android and web do not expose
the normalization switch yet.

Canonical integration: `plugins/with-crimson-playback-controls.js`, called by the
existing equalizer plugin during prebuild/postinstall. The render DSP uses fixed
state and no locks or allocations. Preferences persist in the settings store.

Validation includes native generated audio at 44.1/48/96 kHz (level matching,
stereo, silence, peak limiting, and disable recovery), actual interleaved/planar
AudioTapProcessor buffers, settings restoration, and both crossfade decks.

Playlist photos are uploaded through Audius image storage and the returned CID
is sent as `playlist_image_sizes_multihash` in the create request. Failed uploads
stop creation. Empty playlists use a music-list icon; one to three available
covers use a single image, and four covers use a collage without a logo overlay.

## Queue and discovery controls

Artwork follows horizontal drags on iOS, Android and web; a committed swipe gives
one native haptic tick. Desktop artwork also accepts left/right arrow keys. Track
changes and unmounts cancel pending transitions, and reduced motion skips them.

Up Next keeps history, the current occurrence and upcoming songs together.
Swipe left on an upcoming mobile row to remove it; desktop offers a remove button.
Undo restores that occurrence without replacing newer queue edits. Manual entries
are labeled “Added by you” and automatically appended entries “Autoplay”. Save
queue captures the full order when opened, then creates a private playlist only
when Save playlist is pressed; repeated songs are saved once. The save action sits below the songs, replacing
the queue footer’s autoplay switch; Undo remains accessible above the list.

Song menus offer More like this and reversible exclusions for a song or artist.
These preferences are account-scoped on the device/browser and affect discovery,
Related, personal mixes and autoplay. Explicitly selected music and library
contents remain available. Picked for you shows the ranking reason.

High-frequency artwork meters update Reanimated shared values without React
commits. Web cover dragging writes only its transform; the desktop playback clock
subscribes separately from the artwork and queue. Tests exercise 200 audio packets
and pointer movements without additional React commits. This verifies render
isolation, not a measured battery-life improvement on physical hardware.

Vault retains its original artwork and glass styling. Its expansion and control
slides run through Reanimated on the UI thread; closed mood buttons are unmounted
after the closing animation. Animated artwork explicitly stops decoding when Home
loses focus, the app backgrounds, or the card leaves the viewport. Web uses the
original first frame while inactive because browser animated images cannot pause.
Native selection haptics accompany direct control actions and option changes;
automatic playback and web controls do not trigger vibration.
