# Privacy and data storage

This document describes the current source implementation. A fork or distributed build may configure different services; its operator is responsible for describing those changes.

Crimson connects directly to Audius. It does not create a separate Crimson account or use Firebase, and this repository does not provide an account database or music proxy server.

## Sign-in and account actions

Sign-in opens Audius authorization in a system browser session or web popup. Crimson receives OAuth tokens and an Audius profile; it does not collect the listener's Audius password. It requests `write` access so actions such as favoriting music, following artists, editing playlists, and changing the display name or profile photo can update the listener's Audius account.

The application's public Audius key identifies the OAuth client. Authenticated requests use the listener's token. Audius remains responsible for the account and the data stored by its service.

## Local storage

| Data | Storage and purpose |
| --- | --- |
| OAuth access/refresh tokens and session profile | SecureStore on iOS/Android; `sessionStorage` on web |
| Selected genres and recommendation preferences | Account-scoped AsyncStorage records on the device/browser |
| Theme, Data Saver, Reduce Motion, Performance Mode, crossfade | Local app settings; crossfade is off by default |
| Listening history and statistics | Local account-scoped records, including track metadata, timestamps, and playback duration |
| Your Mixes editions | Account-scoped local song caches, calendar periods, and bookmarked mix IDs |
| Library/discovery caches and download settings | Local account-scoped records used for loading and offline behavior |
| Downloaded music | Native app files and a local manifest; unsupported on web |
| Local Music | A device/browser-wide metadata index; imported audio copies in native app files or web IndexedDB; scanned device-library references |
| Local-file favorites | Account-scoped local track IDs; not Audius favorites or cloud sync |
| Native widget state | Display metadata and a cached thumbnail in the iOS App Group or Android app storage; no OAuth tokens or stream URLs |
| Artwork, cover palettes, and circular profile thumbnails | Image/system caches and, for the iOS native helpers, local cache files |

Preferences and local listening history are not a Crimson cloud sync service. Library changes are stored by Audius. Local preference/cache records and downloaded music are not stored in the secure credential store and are not encrypted by the application itself.

Local Music imports are copied into Crimson's storage without uploading audio to Audius. Android device scanning requests access to indexed audio; iOS scanning requests access to the system media library and excludes protected/cloud-only items. File pickers grant access to chosen documents; a browser cannot scan the device automatically. The Local Music collection is shared across accounts on the same installation, while its Favorites selections are account-scoped.

Widgets can display track/artist names, artwork, playback state, source, and the next track's title on the Home Screen. They receive neither credentials nor the full queue or listening history. Signing out clears their personal display snapshot and cached thumbnail; the OS controls when a visible widget refreshes. See [widget behavior](WIDGETS.md).

Web `sessionStorage` is readable by scripts on the same origin; it is not equivalent to native SecureStore. On iOS, the configured secure-storage accessibility allows token refresh after the device's first unlock, including during background playback.

## Network requests

Browsing and playback send requests to Audius and the media/artwork hosts returned by its responses. Those services receive normal connection information, such as the requesting IP address and requested resource. The app can also check Audius connectivity and open Audius or attribution links in a browser.

Advanced search sends the selected filters and search term to Audius. Mix generation combines Audius recommendations, followed releases, favorites, and local ranking signals; it does not upload Crimson's listening-history records. Liking or unliking a mix changes only its account-scoped local bookmark; it does not create, update, or upload an Audius playlist or artwork. Previous local save markers are migrated to bookmarks without modifying previously created Audius playlists. Crossfade can fetch the next track before the current one finishes. Native widget thumbnails may be fetched from the supplied artwork host.

Before login, the welcome screen requests public trending artwork from Audius without account credentials. It caches the artwork list in memory for up to an hour and uses bundled images when unavailable. Data Saver requests smaller covers, and Reduce Motion or Performance Mode stops the scrolling artwork.

Edit profile opens the system photo picker or browser file chooser. A selected photo stays in the editor preview until Save. Saving uploads the photo to an Audius storage node, then updates the public Audius profile using the listener's authorized session. The OAuth token is sent only to the Audius API, never to photo storage. A failed profile update after a successful upload may leave an unreferenced image on Audius storage.

Listening history and statistics are computed locally. That does not make streaming private from Audius or its delivery hosts: they still receive the requests needed to serve music. Data Saver reduces artwork and discovery traffic and limits downloads to Wi-Fi; it does not change the audio bitrate or eliminate network requests.

Voice search asks for microphone and speech-recognition access when used. Recognition is provided by the device/browser's speech service and is not forced to run entirely on-device. Recognized text becomes the search query sent to Audius. Crimson does not implement its own voice-recording upload server.

## Optional Sentry reporting

Remote error reporting is disabled unless the build has `EXPO_PUBLIC_SENTRY_DSN`, and is disabled in development mode. An enabled release build can send errors, operation tags, and sampled performance traces to the configured Sentry project; the configured trace sampling rate is 10%.

The implementation disables default personal-information collection, removes event user/request fields, and filters console breadcrumbs. These filters do not guarantee that every error message is free of sensitive context. Build operators should review their reporting configuration and disclose the receiving project and any additional instrumentation. Sentry source-map upload credentials belong in private build secrets.

## Clearing data and disconnecting

**Log Out** clears the stored login session and widget display data, and attempts to revoke its refresh token at Audius. It does not erase downloaded/imported music, mix editions and bookmarks, preferences, or listening history.

**Account → Clear Data & Disconnect** removes that account's local downloads, history, library caches, mix editions and bookmarks, local-file favorites, and preferences, then logs out. It does not delete the Audius account or undo favorites, follows, and playlists on Audius, including mixes saved as playlists by earlier versions. App-wide settings, the shared Local Music collection, imported audio, and shared/system artwork caches are separate from account cleanup.

Remove imported audio through its Local Music song menu to delete Crimson's copy. Scanned device files must be removed through the device's file/music tools and rescanned. Clearing browser site data removes imported browser copies and their metadata.

Token revocation is best effort and may fail without a working connection. Use Audius's account controls to manage authorized applications or Audius account data. Browser site-data controls can clear web storage and caches.

For a suspected data exposure or vulnerability, follow the private reporting instructions in [SECURITY.md](../SECURITY.md).
