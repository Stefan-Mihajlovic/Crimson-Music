# Local Music

Local Music is a permanent Library collection on iOS, Android and the web. Its
files remain on the device; Crimson does not upload them to Audius.

The collection uses the standard playlist screen. Its ellipsis opens the existing
action-sheet popup, with Import audio files, Scan device (Import folder on web),
and About Local Music. Imported-copy removal stays in each song’s action sheet.

- **Android:** Scan device requests only the audio permission on Android 13+ (or
  external storage access on Android 12 and earlier), then reads all nonempty
  MediaStore audio. It includes recordings and podcasts, without an `IS_MUSIC`
  filter. The system file picker also imports individual audio files.
- **iOS:** Scan device requests Media & Apple Music permission and reads downloaded,
  unprotected audio exposed by MediaPlayer. Subscription DRM and cloud-only music
  cannot be played through this interface. Import files uses Apple's document
  picker, including Files/iCloud/file providers. Imported copies live in
  Documents/CrimsonLocalMusic, visible through Files. iOS does not permit scanning
  every other app's private storage.
- **Web:** Import files/folder uses the browser's picker. Audio Blobs persist in
  IndexedDB and are restored after reload. Metadata is stored separately; playback
  creates a fresh object URL from the Blob. Clearing site storage removes these
  copies. File extensions and audio MIME types identify audio; actual codec
  playback depends on the browser or OS decoder.

Native importers retain title, artist, album, duration and artwork when supplied.
Web imports retain filename and duration. Content hashes deduplicate repeated
imports. Android device files use MediaStore IDs. Imported copies can be removed
from the song action sheet without deleting the original selected file. A device
rescan removes references to device audio no longer exposed by the OS; it keeps
Crimson's imported copies. Imported-folder refresh removes missing imported files.

Favorites and owned playlists can include local files and work offline. Local
playlist membership and the order of mixed local/Audius tracks are stored per
account on this device. Audius receives only remote track IDs; local files and
private device URIs are never uploaded. The picker offers Create new playlist,
Favorites, then owned playlists. Removing an imported file hides its unavailable
playlist entries without breaking the rest of the playlist. Local listening
history and resumed playback preserve the local source.

The native implementation is maintained by `plugins/with-local-music.js` and the
canonical sources in `plugins/crimson-local-music`. Expo prebuild installs the
module and permissions; no additional npm/native library is required. Local
metadata is persisted in bounded pages to avoid Android's per-row SQLite read
limit on large music collections.

Tests cover import persistence and deduplication, rescans and denied permissions,
local playback routing, offline Favorites, prevented Audius writes, playback
resume/history, default collection placement, picker Favorites and cover images.
Physical-device validation should include selecting actual audio, denying and
regranting scan permission, adding/removing audio outside Crimson, and relaunching
with networking disabled.
