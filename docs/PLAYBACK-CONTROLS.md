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
