# App improvements

This change implements the discovery, collection, playback, account, and platform work from the app review. **Music Preferences (review item 12) is excluded**: its screens, step order, and Liquid Glass swipe are unchanged. Saved preferences now inform discovery in the music service.

| Area | Result |
| --- | --- |
| Home | Continue listening, recent collections, offline shortcuts, followed-artist releases, genre-aware recommendations with reasons, and refresh/retry. Song results can appear before secondary discovery sections finish. |
| Vault | Choose a mood, regenerate the last mood, and save the generated track list as an Audius playlist. |
| Search | Recent searches, a top result, type filters, paginated song/artist/playlist results, and explicit failures. Removed the unsupported Profiles filter. |
| Library | Cached content before refresh, one collection, Favorites pinned first, recent/alphabetical sorting, type/download filters, and persisted layout. |
| Playlists | Search and sort visible songs, total duration, rename/description/privacy, reorder/remove tracks, and delete owned playlists. Editing uses a modal above the player. |
| Artists | Separate latest/popular tracks and discography; pagination advances using API records rather than filtered visible counts. Follow mutations show pending state. |
| Playback | One ordered queue shared by next/previous and swipe; Play Next/Add/Remove/reorder; account-local paused restore; bounded recovery; responsive full-player controls. |
| Listening history | Search, date groups, recent-track/session views, local clear, and elapsed-time statistics. Seeking and buffering do not inflate listened time. Repeated progress checkpoints replace the same session record. |
| Account | Playable monthly recap, local-data explanation, privacy page, clearer storage controls, and cleanup that retains the session if removal fails. |
| Notifications | New Music/Activity filters, date groups, and a local seen cursor shared with the header badge. This does not mark notifications read in Audius. |
| Downloads | Visible queue and progress, waiting for Wi-Fi, retry/cancel, immediate network-policy enforcement, and shared automatic/manual transfer scheduling. |
| Web | Responsive sidebar/navigation, persistent player, media commands, keyboard shortcuts, seeking, volume, and CORS-aware artwork color sampling. |
| Android | Canonical, version-guarded adapter for Expo Audio's existing foreground service, next/previous/like commands, and native artwork color sampling. |
| Maintainability | Separate discovery ranking, playback persistence/listening clock, catalog pagination, date grouping, confirmations, and playlist-editor components; platform compilation jobs added to CI. |

The global typography scale is retained to avoid changing existing layouts, including Music Preferences. New controls have explicit text tokens and accessible actions; this is not a claim that every existing screen has completed a typography migration.

## Build and validation boundary

- TypeScript and ESLint checks pass.
- Static web export and unsigned iOS Release compilation pass.
- Android arm64 debug compilation passes; the generated APK is `android/app/build/outputs/apk/debug/app-debug.apk`.
- No unit/integration tests or interactive device/browser checks were run for this change, as requested.
- Builds without `.env` intentionally contain no configured Audius app key. Configure your public key and signing identity before producing an installable personal release.

Native/web runtime behavior still needs the user's device checks. Queue drag handles reorder visible rows; accessible move actions also work, but drag edge auto-scroll is not implemented. Wi-Fi-interrupted downloads restart automatically when eligible; byte-range resume is not implemented. Web pixel extraction falls back when the image host blocks CORS. Android and web remain experimental until their real playback/auth flows have been exercised.
