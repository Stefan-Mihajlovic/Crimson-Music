# Privacy and data storage

This document describes the current source implementation. A fork or distributed build may configure different services; its operator is responsible for describing those changes.

Crimson connects directly to Audius. It does not create a separate Crimson account or use Firebase, and this repository does not provide an account database or music proxy server.

## Sign-in and account actions

Sign-in opens Audius authorization in a system browser session or web popup. Crimson receives OAuth tokens and an Audius profile; it does not collect the listener's Audius password. It requests `write` access so actions such as favoriting music, following artists, and editing playlists can update the listener's Audius account.

The application's public Audius key identifies the OAuth client. Authenticated requests use the listener's token. Audius remains responsible for the account and the data stored by its service.

## Local storage

| Data | Storage and purpose |
| --- | --- |
| OAuth access/refresh tokens and session profile | SecureStore on iOS/Android; `sessionStorage` on web |
| Selected genres and recommendation preferences | Account-scoped AsyncStorage records on the device/browser |
| Theme, Data Saver, Reduce Motion, Performance Mode | Local app settings |
| Listening history and statistics | Local account-scoped records, including track metadata, timestamps, and playback duration |
| Library/discovery caches and download settings | Local account-scoped records used for loading and offline behavior |
| Downloaded music | Native app files and a local manifest; unsupported on web |
| Artwork, cover palettes, and circular profile thumbnails | Image/system caches and, for the iOS native helpers, local cache files |

Preferences and local listening history are not a Crimson cloud sync service. Library changes are stored by Audius. Local preference/cache records and downloaded music are not stored in the secure credential store and are not encrypted by the application itself.

Web `sessionStorage` is readable by scripts on the same origin; it is not equivalent to native SecureStore. On iOS, the configured secure-storage accessibility allows token refresh after the device's first unlock, including during background playback.

## Network requests

Browsing and playback send requests to Audius and the media/artwork hosts returned by its responses. Those services receive normal connection information, such as the requesting IP address and requested resource. The app can also check Audius connectivity and open Audius or attribution links in a browser.

Listening history and statistics are computed locally. That does not make streaming private from Audius or its delivery hosts: they still receive the requests needed to serve music. Data Saver reduces artwork and discovery traffic and limits downloads to Wi-Fi; it does not change the audio bitrate or eliminate network requests.

Voice search asks for microphone and speech-recognition access when used. Recognition is provided by the device/browser's speech service and is not forced to run entirely on-device. Recognized text becomes the search query sent to Audius. Crimson does not implement its own voice-recording upload server.

## Optional Sentry reporting

Remote error reporting is disabled unless the build has `EXPO_PUBLIC_SENTRY_DSN`, and is disabled in development mode. An enabled release build can send errors, operation tags, and sampled performance traces to the configured Sentry project; the configured trace sampling rate is 10%.

The implementation disables default personal-information collection, removes event user/request fields, and filters console breadcrumbs. These filters do not guarantee that every error message is free of sensitive context. Build operators should review their reporting configuration and disclose the receiving project and any additional instrumentation. Sentry source-map upload credentials belong in private build secrets.

## Clearing data and disconnecting

**Log Out** clears the stored login session and attempts to revoke its refresh token at Audius. It does not erase downloaded music, preferences, or listening history.

**Account → Clear Data & Disconnect** removes that account's local downloads, history, library caches, and preferences, then logs out. It does not delete the Audius account or undo favorites, follows, and playlists on Audius. App-wide settings and shared/system artwork caches are separate from account cleanup.

Token revocation is best effort and may fail without a working connection. Use Audius's account controls to manage authorized applications or Audius account data. Browser site-data controls can clear web storage and caches.

For a suspected data exposure or vulnerability, follow the private reporting instructions in [SECURITY.md](../SECURITY.md).
