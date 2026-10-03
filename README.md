<h1>
  <img src="./assets/images/icon.png" alt="Crimson Music icon" width="48" height="48" align="center">
  Crimson Music
</h1>

An open-source Audius music player built with Expo 57, React Native, and TypeScript. Sign in with **Log in with Audius** to listen and manage your Audius library. Crimson uses Audius accounts directly; it has no Firebase dependency or separate account server.

**iOS, Android, and web are supported targets.** See [platform support and build instructions](docs/PLATFORMS.md) for features, requirements, and limitations. iPhone uses Liquid Glass; Android and web use translucent frosted glass with backdrop blur. Offline downloads are available in the mobile apps.

## Features

- Discover music matched to saved genres and listening habits, continue recent listening, and catch new tracks from followed artists.
- Open **Your Mixes** for Daily, Weekly, Monthly, Release Radar, Rediscover, and Hidden Gems editions. Like a mix to bookmark it in Crimson Library; its songs keep updating on schedule.
- Explore artist spotlights and Underground gems with direct track playback.
- Search Audius tracks, artists, and playlists with recent searches and pagination. Expand song filters for genre, mood, key, BPM range, and downloadable tracks, with or without a search term.
- Play music with one ordered queue, queue editing, playback recovery, and a paused session restore. Optional crossfade is off by default and adjustable from 1–12 seconds in Settings.
- Set a sleep timer for 5–90 minutes or the end of the current song, from the player's three-dot menu or Account → Sound & sleep.
- Adjust a five-band equalizer with presets and custom controls. It starts off and remembers settings on this device.
- Manage Audius favorites, follows, and playlists, including privacy, titles, descriptions, track order, and deletion. The Add to playlist picker includes Favorites and playlist covers.
- Keep device audio in the default **Local Music** collection: import files on every platform, scan permitted media libraries on mobile, or import a folder on web. Access and format limits are described in [platform support](docs/PLATFORMS.md).
- Generate a Vault mood mix and save it to your Audius library.
- Personalize discovery with device-local music preferences.
- Edit your Audius display name and profile photo inside Crimson. New listeners complete music preferences before entering the app.
- View local listening history and statistics, and Audius notifications.
- Save music for offline listening on native platforms, with storage controls and a visible download queue, Wi-Fi waiting, retry, and cancellation.
- Use a persistent desktop web player with browser media commands, keyboard shortcuts, seeking, and volume.
- Add small, medium, or large [home-screen widgets](docs/WIDGETS.md) on iOS and Android. Widget controls open Crimson to perform playback or collection actions.
- Use Data Saver, Reduce Motion, and Performance Mode to adjust the experience.

Audius supplies the catalog, streams, identity, and account permissions. Availability and API limits remain subject to Audius. Crimson is an independent client, not an official Audius application.

## Get started

Use **Node.js 24** and npm. Native builds also require Xcode on macOS for iOS, or Android Studio and its SDK toolchain for Android.

```bash
npm ci
cp .env.example .env
```

Register your own application with Audius and set `EXPO_PUBLIC_AUDIUS_API_KEY` in `.env` to its **public app key**. Register these OAuth callbacks for the targets you use:

| Target | Registered callback |
| --- | --- |
| iOS / Android | `crimsonmusic://oauth/callback` |
| Local web | Your exact origin plus `/oauth/callback`, for example `http://localhost:8081/oauth/callback` |
| Hosted web | Your exact HTTPS origin plus `/oauth/callback` |

The public key identifies your application during OAuth authorization and token exchange. Crimson requests the listener's `write` permission to manage their library; music and library requests authenticate with the listener's OAuth token. Listener sign-in does not guarantee exemption from Audius application limits.

Never put an Audius private secret, app bearer token, listener token, or signing credential in an `EXPO_PUBLIC_*` variable. Those variables are bundled into the client. The app obtains listener tokens during sign-in.

Choose a development target:

```bash
npm run ios
# or
npm run android
# or
npm run web
```

Use a native development build for iOS or Android. **Expo Go is unsupported**: Crimson needs its registered callback scheme and custom native integrations. `npm start` starts Metro for an existing development build.

For forks, optional `IOS_BUNDLE_IDENTIFIER`, `ANDROID_PACKAGE`, and `IOS_APPLE_TEAM_ID` values configure your native identity and iOS signing team through `app.config.js`. See [PLATFORMS.md](docs/PLATFORMS.md) for device builds, generated native projects, and web hosting.

## Accounts and privacy

Audius favorites, follows, and playlists belong to the listener's Audius account. Music preferences, mix editions and bookmarks, listening history, local-file favorites, cached data, and download settings live on the device or browser. Imported audio stays local; the Local Music collection is shared across accounts on that installation. Native OAuth sessions use SecureStore; web sessions use the current tab's `sessionStorage`.

Optional Sentry reporting is disabled unless `EXPO_PUBLIC_SENTRY_DSN` is configured, and remains disabled in development builds. See [privacy and data storage](docs/PRIVACY.md) for retention, network requests, and clearing local data.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and available checks. Platform work, accessibility improvements, bug reports, and documentation are welcome. Describe which platforms you actually exercised; do not infer device compatibility from a successful JavaScript check.

Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

Maintainers preparing a public source or binary release should read [publishing notes](docs/PUBLISHING.md).

## Project layout

| Path | Purpose |
| --- | --- |
| `src/app/` | Expo Router screens and OAuth callback |
| `src/components/` | Shared UI and platform-specific controls |
| `src/providers/` | Authentication, playback, downloads, settings, and connectivity |
| `src/services/` | Audius integration, persistence, and local music state |
| `plugins/` | Canonical iOS and Android native integration sources |
| `scripts/` | Native project and dependency compatibility patches |
| `tests/` | Unit and integration tests |

## License

Crimson's source code is available under the [MIT License](LICENSE). Third-party dependencies and bundled assets retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The code license does not grant rights to music, artwork, or Audius branding supplied by the service.
