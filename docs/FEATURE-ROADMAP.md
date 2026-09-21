# Crimson: 100 feasible feature additions

Research and repository audit: 13 September 2026. This is a proposed product backlog, not a claim that these features are implemented or a delivery commitment. Effort is relative engineering scope, including integration and platform validation, not a calendar estimate.

Crimson can become a compelling daily player through discovery control, library ownership, dependable playback, and an excellent Audius experience. It cannot promise that a listener's Spotify or Apple Music catalog exists on Audius. The strongest initial audience is Audius listeners, independent-music explorers, and people who also maintain a personal music collection. Catalog matching and real switching trials should test expansion beyond that audience.

## What already exists

The audit covered README, platform/improvement documentation, the player and download providers, music/Audius services, discovery ranking, shared music types, and collection/settings code. This was source inspection, not a fresh runtime validation.

- Audius login, likes/favorites, follows, and owned-playlist CRUD, privacy, descriptions, track reordering, and removal.
- Personalized Home with recommendation reasons, followed-artist releases, recent collections, spotlights, Underground gems, and saved genre/recommendation-style preferences.
- Vault mood mixes, regeneration, and saving mixes as playlists.
- Track/artist/playlist search, voice search where supported, recent searches, filters, pagination, and search within collections.
- Ordered queue, Play Next, add/remove/reorder, shuffle, repeat, related tracks, autoplay, playback recovery, and paused session restore.
- Native offline storage, automatic downloads, storage limits, Wi-Fi policies, retry/cancel, progress, and collection targets.
- Listening history, local listening statistics, and a playable monthly recap.
- Artist catalogs/discography, event pages, in-app Audius notifications, profile editing, themes, Reduce Motion, Performance Mode, and Data Saver.
- Background/remote controls and a persistent desktop web player with keyboard shortcuts.

Important gaps: `loadPlayerLyrics()` currently returns empty lyrics; lyric rendering components are groundwork, not working catalog lyrics. Custom playlist artwork is rejected by the creation service. Notifications are in-app, without push delivery. Web downloads are unsupported. Current song types support Audius only. Preferences/history remain local; there is no Crimson backend. The player owns one Expo audio player; gapless playback and crossfade need audio-engine work.

Local evidence: [current features](../README.md), [platform boundaries](PLATFORMS.md), [music service](../src/services/music.ts), [player](../src/providers/player-provider.tsx), [downloads](../src/providers/download-provider.tsx), [ranking](../src/services/discovery-profile.ts), [types](../src/types/music.ts).

## Lessons from other services

| Service | Relevant benchmark | Crimson opportunity |
| --- | --- | --- |
| Spotify | Daylist/Daily Mix/Blend, recommendation injection, shared Jam queues, device remote control, taste controls. | Make discovery tunable, make group listening easy, and let a phone control Crimson on a computer. [Personalization](https://newsroom.spotify.com/2024-06-10/my-spotify-personalized-playlists-daylist-made-for-you/), [Smart Shuffle](https://newsroom.spotify.com/2023-03-08/smart-shuffle-new-life-spotify-playlists/), [Jam](https://support.spotify.com/us/article/jam/), [Connect](https://support.spotify.com/us/article/spotify-connect/), [Taste Profile](https://support.spotify.com/us/article/your-taste-profile/). |
| Apple Music | Adjustable Crossfade and dynamic AutoMix; Replay and library ratings/favorites. | Refine transitions, treat collections seriously, and expand the existing recap. [Transitions](https://support.apple.com/en-us/105067), [Replay](https://support.apple.com/en-ie/109356), [Ratings and personalization](https://support.apple.com/en-lamr/guide/music/musf7da17c25/mac). |
| Deezer | Flow, mood mixes, SongCatcher, and Shaker group mixes. | Turn Vault into a persistent personal station; use shared taste for group discovery. Recognition needs a separate provider and is not automatically Audius-wide. [Feature overview](https://newsroom-deezer.com/2022/11/showcasing-deezer-the-coolest-features-and-a-hifi-quality-catalogue/), [Shaker](https://newsroom-deezer.com/2023/11/deezer-introduces-shaker/). |
| TIDAL | Discovery/activity mixes, selectable audio quality, offline playback, and TIDAL Connect. | Prioritize playback transparency and devices; quality claims must reflect the actual available source. [Feature directory](https://support.tidal.com/hc/en-us/categories/200514272-Explore-TIDAL), [Connect](https://tidal.com/connect). |
| YouTube Music | Samples discovery and Smart Downloads. | Build a lightweight audio-preview discovery deck and a deliberate offline discovery pack. [Samples](https://blog.google/intl/en-mena/product-updates/connect-communicate/youtube-music-discovery-to-the-next-level-with-samples/), [Downloads](https://support.google.com/youtubemusic/answer/6313535?hl=en-GB). |
| SoundCloud | Reposts that distribute discoveries through a following feed. | Surface Audius reposts and curators, with controls over repetition. [Reposts](https://help.soundcloud.com/hc/en-us/articles/115003567488-Reposting-tracks-or-playlists). |

These are feature-pattern references, not a claim of complete parity or uniform availability across subscription plans, countries, and devices. Older announcement pages establish design precedents; they do not establish every current rollout detail.

## Feasibility key

- **C — Client:** implement inside Crimson using local state and existing data. Remote catalog calls still incur Audius limits.
- **A — Audius:** extend the integration using documented endpoints or metadata. Validate real responses, authorization, and coverage before committing to a release.
- **N — Native:** OS integration or audio-engine work; web parity is separate.
- **B — Backend:** new optional Crimson coordination/sync service, hosted or self-hosted, with ongoing operational cost.
- **X — External/conditional:** another provider, content permission, platform approval, or additional catalog coverage is required.
- **S / M / L:** small bounded change / moderate subsystem / large multi-part initiative. Combinations identify multiple dependencies. Small means small relative to this repository, not trivial.

All rows describe an addition or a specific expansion beyond the audited baseline. Where API data is missing, the UI must show unknown or unavailable rather than inventing metadata. Discovery algorithms below are achievable heuristics; their quality must be tested and is not guaranteed to match incumbents.

## 1. Discovery worth returning for

| ID | Addition | Practical first version | Route · effort |
| --- | --- | --- | --- |
| 01 | Personal continuous station | A stable entry point mixing favorites and new candidates with session feedback; extend Vault and autoplay. | C+A · M |
| 02 | Daily mixes by taste cluster | Separate mixes for the listener's main genres/artists; rotate daily and preserve a day's result. | C+A · M |
| 03 | Weekly discovery edition | A dated selection of unheard tracks with an archive and save-all action. | C+A · M |
| 04 | Time-of-day mixes | Learn morning/evening patterns locally; offer manual contexts until sufficient history exists. | C · M |
| 05 | Multi-seed radio | Combine several chosen artists/tracks with adjustable weights; merge and rank candidate pools. | C+A · M |
| 06 | Discovery shuffle | Optionally interleave clearly labeled recommendations into an existing playlist; retain the original order. | C · M |
| 07 | Forgotten favorites | Resurface liked songs absent from recent listening, with a selectable lookback period. | C · S |
| 08 | Unheard-library mix | Play saved songs the device's history has never recorded, labeled as such. | C · S |
| 09 | Release inbox | Add unheard/heard status, save-for-later, and artist-specific filters to the existing release feed. | C+A · M |
| 10 | Audio discovery deck | User-started short previews with save/skip/full-track actions; use supplied preview offsets where available. | C+A · M |

## 2. Control over recommendations and search

| ID | Addition | Practical first version | Route · effort |
| --- | --- | --- | --- |
| 11 | Never recommend this track/artist | A reversible blocklist respected by Home, mixes, and autoplay; direct searches can still show the item. | C · S |
| 12 | Snooze an overplayed song | Suppress it for a chosen period with expiry and undo. | C · S |
| 13 | Context-specific taste controls | Expand existing familiar/balanced/surprise/underground preferences into per-station freshness, artist variety, and familiarity controls. | C · M |
| 14 | Exclude from taste learning | Per-playlist and per-session exclusion for sleep, children's music, or shared speakers. | C · M |
| 15 | Editable taste evidence | Expand current reason labels into the actual signals, removable history influences, and adjustable genre weights. | C · M |
| 16 | Recommendation cooldowns | Configurable repeat windows and minimum artist spacing across generated sessions. | C · M |
| 17 | Advanced catalog filters | Genre, mood, BPM range, musical key, and downloadable content; expose existing Audius search capabilities. | A · M |
| 18 | Natural-language mix recipes | Parse requests such as “45 minutes of mellow house, mostly new artists” into visible editable filters; a rules parser is enough initially. | C+A · M |
| 19 | Saved searches and result changes | Save filter combinations and highlight newly found tracks when opened; background alerts can follow later. | C+A · M |
| 20 | Version-aware matching | Distinguish original/remix/live/sped-up candidates using metadata and title hints; let users confirm uncertain matches. | C+A · M |

Audius currently documents genre/mood/BPM/key/download filters and ISRC lookup. These help search and matching without building a catalog-scale audio model. They do not guarantee complete metadata or the presence of another service's recordings. [Track SDK](https://docs.audius.co/sdk/tracks/), [advanced-search engineering](https://engineering.audius.co/key-bpm-search-at-audius/).

## 3. A library people can build around

| ID | Addition | Practical first version | Route · effort |
| --- | --- | --- | --- |
| 21 | User-controlled pins | Pin and order any playlist, artist, album, or station; expand beyond automatically pinned Favorites. | C · S |
| 22 | Folders and shelves | Organize collections into Work, Running, New Finds, and nested folders, initially local. | C · M |
| 23 | Smart playlists | Saved rules over library metadata/history, such as “liked house, unplayed for 30 days”; export snapshots to Audius. | C · M |
| 24 | Personal tags and ratings | Multiple tags, stars, and notes that do not alter the artist's Audius metadata. | C · M |
| 25 | Proper album library | Preserve album identity, distinguish albums from playlists, and support saved albums/listened progress. | A+C · M |
| 26 | Bulk collection actions | Multi-select to add, remove, download, tag, or move; show partial failures. | C · M |
| 27 | Playlist maintenance tools | Duplicate, merge, find overlap, and review duplicates without conflating different versions. | C+A · M |
| 28 | Playlist version history | Save snapshots before Crimson edits and preview a restoration; detect conflicting remote changes. | C+A · M |
| 29 | Custom playlist artwork | Upload or generate a local collage and attach it through Audius's upload/playlist path; local-only cover fallback. | A · M |
| 30 | Listen-later shelf | Save music to audition without prematurely liking it; move reviewed items into chosen collections. | C · S |

Audius exposes albums and playlist updates; new local concepts such as tags, folders, rules, and versions are Crimson data rather than assumed Audius fields. Playlist artwork needs an actual image upload, not just a device URI. [Playlist SDK](https://docs.audius.co/sdk/playlists/), [Album SDK](https://docs.audius.co/sdk/albums/), [Uploads](https://docs.audius.co/sdk/uploads/).

## 4. Better playback and sound

| ID | Addition | Practical first version | Route · effort |
| --- | --- | --- | --- |
| 31 | Sleep timer | Stop after a duration, track, album, or queue, with an optional gentle fade; native scheduling for background accuracy. | C+N · M |
| 32 | Gapless playback | Native queued decoding/preparation and compatible source handling; verify joins with known continuous audio. | N · L |
| 33 | Adjustable crossfade | User-set overlap and album-aware bypass; requires coordinated playback of two audio sources. | N · L |
| 34 | Loudness normalization | Measure supported audio, cache gain values, apply headroom, and support track/album modes. No invented loudness metadata. | N · L |
| 35 | Equalizer and presets | Native DSP with gain/headroom handling; web audio has separate CORS and implementation constraints. | N · L |
| 36 | Device-specific sound profiles | Remember EQ/volume preferences for selected output routes where the OS exposes a usable identity. | N · M |
| 37 | Better shuffle modes | Artist-spaced shuffle, album shuffle, and least-recently-played ordering as explicit choices. | C · M |
| 38 | Queue snapshots | Save a queue as a playlist, name temporary sessions, and restore the previous queue after an accidental replacement. | C · M |
| 39 | Bookmarks and A–B looping | Save timestamps in long mixes and repeat a chosen section for practice; native timing for accurate loops. | C+N · M |
| 40 | Playback speed with pitch control | Variable speed, optional pitch preservation, and reset; expose only combinations supported by each audio engine. | N · M |

Crimson currently uses a single Expo player. Gapless, overlap, DSP, and normalization should share a deliberate audio architecture project. A fast JavaScript “play next” callback is not proof of gapless output. Android's native playlist API provides a useful underlying route, but each platform and source format still needs validation. [Media3 playlists](https://developer.android.com/media/media3/exoplayer/playlists).

## 5. Offline listening that earns trust

| ID | Addition | Practical first version | Route · effort |
| --- | --- | --- | --- |
| 41 | Trip packs | Build a chosen number of hours from saved and new music; display actual coverage and missing tracks. | C · M |
| 42 | Offline discovery refresh | A bounded rotating discovery pack in addition to current favorites/playlist auto-downloads; obey content eligibility and network policy. | C+A · M |
| 43 | Per-playlist download rules | Choose keep current, snapshot only, or manual refresh; show added/removed download differences. | C · M |
| 44 | Protected downloads | Let users pin files against automatic eviction and explain what storage cleanup will remove. | C · S |
| 45 | Native background transfers | OS-managed progress and recovery when the UI is suspended; describe OS limits honestly. | N · L |
| 46 | Byte-range resume | Continue partial transfers only when server range support and file validators permit; restart safely otherwise. | N+A · L |
| 47 | Offline library search | Index downloaded metadata for immediate searching, grouping, and filtering with no network. | C · M |
| 48 | Download repair | Detect missing/truncated files, show affected playlists, and repair only those items. | C+N · M |
| 49 | Downloaded-only session | Generate and maintain an entire queue from available local files; avoid autoplay wandering online. | C · S |
| 50 | Rich offline context | Retain cover art, artist information, personal notes, and permitted lyrics alongside the music. | C+X · M |

Existing download support is not a blanket entitlement to archive every recording. Before expanding policy, verify the distinction between app-managed offline caches, artist-enabled file downloads, gated access, and the current Audius service terms. Native background execution and server byte ranges are capabilities to test, not guarantees.

## 6. Make switching and ownership practical

| ID | Addition | Practical first version | Route · effort |
| --- | --- | --- | --- |
| 51 | Playlist import from files | Accept CSV/M3U/JSON metadata with a preview; no direct incumbent API dependency for this first version. | C+A · M |
| 52 | Honest migration report | Separate exact recording matches, candidates needing review, and missing recordings; preserve the original source list. | C+A · M |
| 53 | Direct service import connectors | Optional OAuth integrations for supported providers once access, quotas, and terms are verified. Keep file import as fallback. | X+B · L |
| 54 | Local audio library | Import user-selected MP3/AAC/FLAC and other supported files with metadata; expose platform codec limits. | N+C · L |
| 55 | Mixed-source playlists | Combine local files and Audius tracks, marking local-only entries on another device; Audius exports contain supported IDs only. | C+N · L |
| 56 | Watch music folders | Desktop/Android rescanning where permissions allow; on iOS begin with Files import and retained supported access. | N · M |
| 57 | Personal music-server connection | Add one documented user-hosted music-server protocol after the source abstraction exists; verify protocol details during implementation. | X+N · L |
| 58 | Open data export | Portable playlists, tags, rules, settings, and listening events, with a documented versioned schema. | C · M |
| 59 | Encrypted cross-device backup/sync | Optional sync for Crimson data with device enrollment, conflict handling, and recovery; do not republish private state to Audius. | B+N · L |
| 60 | Missing-music watchlist | Preserve unmatched imports and recheck Audius when requested; notify when a credible match becomes available. | C+A · M |

Audius supports lookup by ISRC as well as normal search. A matching identifier still needs metadata/version checks. Migration transfers references and preferences, not Spotify/Apple Music audio licenses. Local import accepts user-accessible files, not another app's protected downloads. [Track SDK](https://docs.audius.co/sdk/tracks/).

## 7. Listening with other people

| ID | Addition | Practical first version | Route · effort |
| --- | --- | --- | --- |
| 61 | Collaborative playlists | A Crimson-owned shared edit log with owner/editor roles and conflict resolution; optional owner-published Audius snapshots. | B · L |
| 62 | Shared party queue | QR invite, guests propose/add tracks, host controls one playback device, and queue persists through reconnects. | B · L |
| 63 | Synchronized listening rooms | Each listener fetches authorized audio independently; coordinate track/time and correct drift rather than rebroadcast audio. | B+N · L |
| 64 | Group taste mix | Blend voluntarily shared preferences or selected playlists; show whose taste contributed each choice. | C+B · M |
| 65 | Opt-in friend activity | Share current/recent listening only when enabled; allow private sessions and per-friend visibility. | B · M |
| 66 | Audius curator/repost feed | Browse followed users' reposts and playlists with deduplication and follow controls. | A · M |
| 67 | Track comments and replies | Integrate Audius discussion, reporting, and timestamp navigation where supplied; validate OAuth writes per endpoint. | A · M |
| 68 | Share cards with timestamps | Generate artwork cards/QR links that open a track or a chosen moment in Crimson, with a web fallback. | C · M |
| 69 | Party fairness controls | Per-person add limits, votes, duplicate prevention, guest removal, and host-only skip rules. | B · M |
| 70 | Shared listening inbox | Send recommendations between consenting Crimson users with an optional note and heard/saved status. | B · M |

Shared state is a new service, not an assumed Audius feature. Start with one playback device for parties before tackling multi-device synchronization. Public spaces add moderation and abuse costs. Spotify Jam and Deezer Shaker provide useful UX precedents; Crimson must build its own coordination. [Jam](https://support.spotify.com/us/article/jam/), [Shaker](https://newsroom-deezer.com/2023/11/deezer-introduces-shaker/).

## 8. Fit into the listener's devices

| ID | Addition | Practical first version | Route · effort |
| --- | --- | --- | --- |
| 71 | Crimson device remote | Pair phone and desktop/web Crimson to control play/pause/seek/queue on the active player; secure enrollment and revocation. | B+N · L |
| 72 | Playback handoff | Transfer queue and approximate position to another Crimson instance, handling unavailable/local-only tracks explicitly. | B+N · L |
| 73 | In-app AirPlay picker | Expose supported native output routing with correct session metadata and interruption behavior. | N · M |
| 74 | Google Cast sender/receiver | Add native sender UI and a receiver that can fetch permitted Audius streams without exposing listener credentials. | N+X · L |
| 75 | CarPlay browsing | Native audio templates for favorites, playlists, search, and now playing; depends on Apple entitlement approval. | N+X · L |
| 76 | Android Auto browsing | Expose the library through a proper media browse service; current lock-screen commands alone are insufficient. | N · L |
| 77 | Home/lock-screen widgets | Play pinned playlists or resume a station using platform-supported widget actions and shared state. | N · M |
| 78 | System shortcuts | Expose play collection, start station, and sleep-timer actions; voice availability follows OS support. | N · M |
| 79 | Native desktop package | Signed builds with tray/menu-bar controls, global hotkeys, and local-file access; maintain a platform-specific release pipeline. | N · L |
| 80 | Watch companion | Start with phone playback control and favorites; standalone streaming/offline playback is a later project. | N · L |

Crimson remote control would work between Crimson clients, not automatically with Spotify Connect/TIDAL Connect speakers. AirPlay and Cast are distinct integrations. CarPlay requires a platform entitlement. [Spotify Connect](https://support.spotify.com/us/article/spotify-connect/), [TIDAL Connect](https://tidal.com/connect), [CarPlay entitlement](https://developer.apple.com/documentation/carplay/requesting-carplay-entitlements).

## 9. Make Audius's artist ecosystem a strength

| ID | Addition | Practical first version | Route · effort |
| --- | --- | --- | --- |
| 81 | Remix family explorer | Show originals and explicit remix relationships with playable comparisons; do not infer attribution from titles alone. | A · M |
| 82 | Stems and alternate versions | Browse artist-provided stems/instrumentals and available download actions with access status. | A · M |
| 83 | Track information and credits | Expose available license, release, BPM, key, and contributor information; use attributed artist additions for missing credits. | A+X · M |
| 84 | Artist essentials journey | Offer a starter set from popular tracks, recent work, and artist picks where present, then suggest deeper cuts. | C+A · M |
| 85 | Curated scene guides | Human-maintained genre/scene collections with artist context and linked playlists; distribute a versioned public guide index. | C+A · M |
| 86 | Remix contest tracker | Extend existing events with watchlists, deadline reminders, and entry browsing where exposed by Audius. | C+A+N · M |
| 87 | Artist-specific release alerts | Add priority artists, quiet hours, and digest controls; timely push delivery needs a relay/scheduler. | A+B+N · L |
| 88 | Support-the-artist shortcuts | Show verified artist-provided links or open Audius purchase/tip flows; native payments would be a separate integration. | A · S |
| 89 | Working lyrics | Import personal LRC files first; add artist-authorized or licensed lyrics with explicit source and availability. Reuse current renderers. | C+X · M |
| 90 | Practice mode | Combine timed lyrics, A–B loops, and speed control; use artist-supplied instrumentals where available. | C+N+X · M |

The current Audius OpenAPI includes comments, reposts, remix/stem routes and related metadata. Endpoint existence is evidence for an integration path, not proof of universal metadata, write scopes, or content access. The checked schema was downloaded from the live API reference during this audit. [API reference](https://api.audius.co/v1), [OpenAPI schema](https://api.audius.co/v1/swagger.yaml).

## 10. Personal, open, and comfortable to use

| ID | Addition | Practical first version | Route · effort |
| --- | --- | --- | --- |
| 91 | Custom recap periods | Weekly, annual, and arbitrary-date recaps with comparisons; extend the existing monthly recap and distinguish incomplete history. | C · M |
| 92 | Listening journal | Notes and saved memories attached to tracks, albums, sessions, and dates. | C · S |
| 93 | Discovery insights | Show new-to-you artists, saves after discovery, and how recommendations led to favorites, using known local events. | C · M |
| 94 | Scrobbling | Optional Last.fm/ListenBrainz adapters with an offline outbox, deduplication, and user consent; verify each API during implementation. | X · M |
| 95 | Configurable Home | Hide/reorder existing sections and add shelves/stations; keep a reset-to-default action. | C · M |
| 96 | Theme and density controls | Extend current Light/Dark/Auto with accent palettes, artwork intensity, compact/spacious layouts, and a pure-black option. | C · M |
| 97 | Accessible reading and controls | Large text that reflows, stronger contrast, adjustable lyric size, clear focus order, and full keyboard/screen-reader queue editing. | C+N · M |
| 98 | Private listening mode | Pause Crimson history/taste updates/scrobbling and social sharing for a session; explain that Audius still receives playback/network requests. | C · M |
| 99 | Portable self-hosted companion | Package the optional sync/room services with documented APIs and backups so users can choose their server. | B · L |
| 100 | Declarative community extensions | Begin with importable themes and mix recipes with versioned schemas; arbitrary executable plugins require a later security model. | C · M |

## Recommended delivery order

Do not build all 100. Choose a coherent switching proposition, ship a complete loop, and use listener behavior to decide which branch earns further investment.

| Phase | Scope | Why it belongs here |
| --- | --- | --- |
| First: daily-use improvements | 11–12 blocks/snooze; 17 advanced search; 21 pins; 23 smart playlists; 30 listen later; 31 sleep timer; 37 better shuffle; 38 queue snapshots; 58 export; 98 private listening. | Clear utility with limited new infrastructure. Sleep timing needs native work; the rest mostly extends current foundations. |
| Next: a reason to return | 01 personal station; 03 weekly discovery; 09 release inbox; 13–16 meaningful control; 41 trip packs; 81 remix explorer. | Connect discovery to saving, listening, and offline use. Avoid launching many barely different mix screens at once. |
| In parallel with product iteration, if capacity exists: switching foundation | 51–52 import/coverage review; 54–55 local library and mixed playlists; 59 optional sync. | Removes migration friction and lets users keep music absent from Audius. This is a larger architectural stream, not a quick follow-up patch. |
| Then: premium playback quality | 32 gapless; 33 crossfade; 34 normalization; 45 background downloads. | Requires focused native work and physical-device audio validation. Treat playback reliability as a release prerequisite throughout every phase. |
| Later: ecosystem reach | 71–72 device remote/handoff; 62 party queue; 75–76 car support; 89 licensed/artist lyrics. | High switching value, but new operations, platform dependencies, or content partnerships. Prioritize based on the audience's actual device usage. |

Suggested first ten product bets: **advanced search, controllable personal radio, smart playlists, listen later, sleep timer, improved shuffle, import with a coverage report, local music plus mixed playlists, trip packs, and Crimson device remote/handoff**. Some combine related IDs. The first six are practical early slices; the last four justify dedicated projects.

## Implementation foundations

1. **Separate music sources from collections.** Replace the song type's Audius-only source with a discriminated source model and stable namespaced IDs. Keep playback resolution, metadata lookup, entitlement, offline eligibility, and sharing capabilities explicit per source. Audius account writes remain Audius-specific.
2. **Create a real local library store.** Use a versioned queryable store for rules, tags, import matches, history, and download metadata when scale warrants it; migrate current local storage safely. Smart playlists operate over an identified scope, not an imaginary complete global catalog.
3. **Share recommendation controls.** Apply blocks, exclusions, cooldowns, and feedback consistently across Home, Vault, radio, and autoplay. Start with explainable ranking and diverse candidate retrieval; add models only if measured quality warrants the cost.
4. **Make the audio engine responsible for timing.** Keep queue identity/state synchronized with the native pipeline. Test background transitions, gaps, crossfade, volume, interruption recovery, and listening-time accounting together.
5. **Keep optional server features optional.** Audius owns identity/catalog/account actions. A separate opt-in service owns device pairing, room state, encrypted sync, and push subscriptions. Use verified authentication; a client-supplied Audius user ID is not authentication. Never bundle a private app secret.
6. **Budget catalog calls.** Use caching, pagination, batching, cooldowns, and bounded candidate pools. Scheduled mixes and release polling must fit the current Audius plan; open-source code does not remove hosted-service limits. [Audius API plans](https://api.audius.co/plans).

## Ideas to defer or qualify

- **Full Spotify/Apple Music catalog replacement:** cannot be delivered by Audius client work alone. Measure a listener's actual import coverage; missing artists can dominate every feature benefit.
- **Lossless/Hi-Res/Dolby Atmos everywhere:** require appropriate source assets, permissions, decoding, and output support. Support compatible local files first; do not relabel an ordinary stream as lossless or Atmos.
- **Apple-style adaptive AutoMix:** plausible later with beat-grid analysis, time stretching, transition selection, and quality testing. Basic key/BPM matching is useful but does not reproduce AutoMix.
- **Song recognition or humming search:** technically possible through a recognition provider and a second Audius-match step; database coverage and costs make it conditional. Humming is a separate, harder capability. Current voice search only transcribes a query.
- **Universal lyrics, translations, or vocal removal:** renderer code is not a lyrics catalog. Start with personal/artist-authorized files and supplied instrumentals; licensing and separation models are distinct projects.
- **Global “top 1% fan” badges:** local history cannot support population-wide percentiles. Only show claims grounded in sufficiently complete data.
- **Direct use of Spotify Connect/TIDAL Connect ecosystems:** Crimson pairing is its own system. Compatibility with third-party branded hardware is not inherited by implementing a remote-control screen.
- **Creator upload studio, podcast platform, ticketing marketplace, or payments stack:** possible expansions, but they change the product and maintenance burden substantially. Link into existing artist/Audius flows first.
- **Always-on iOS alarms or unlimited web offline storage:** operating-system/browser limits prevent simple guarantees. Scope capabilities around supported scheduling and storage behavior.

## Prove that Crimson is worth switching to

Run an opt-in switching pilot with three groups: existing Audius listeners, independent-music explorers, and mainstream-service users with local music collections. Keep results separate.

- **Migration:** what share of each person's must-have recordings match exactly, need review, or remain missing? Ask them to review a sample rather than trusting fuzzy matching scores.
- **Activation:** can they bring a playlist, find a new song they save, and prepare offline music in their first session?
- **Daily reliability:** track user-visible play failures, unexpected stops, median/tail time-to-audible-play, download success, and interruption recovery on actual supported devices.
- **Discovery usefulness:** measure recommendation saves, meaningful listening, repeated artist exposure, and explicit feedback. More listening time alone is not proof of satisfaction.
- **Retention:** after a week and a month, ask which sessions moved to Crimson, which stayed elsewhere, and why. Establish a baseline before choosing numeric targets.
- **Trust:** ensure export works, excluded sessions stay out of Crimson learning, private data has understandable controls, and optional server features can be disabled.

The product proposition to test: **“Your Audius discoveries and your own music, organized your way, with recommendations you control.”** For existing Audius listeners, Crimson can aim to become the default client. For other listeners, the coverage report should determine whether full switching or a complementary role is realistic.
