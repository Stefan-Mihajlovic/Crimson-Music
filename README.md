# Crimson Music

An open-source Audius music player built with Expo 57, React Native, and TypeScript. Sign in with **Log in with Audius** to listen and manage your Audius library. Crimson uses Audius accounts directly; it has no Firebase dependency or separate account server.

**iOS is the primary development platform. Android and web are experimental**, with incomplete native feature parity. See [platform support and build instructions](docs/PLATFORMS.md) before choosing a target.

## Features

- Discover music matched to saved genres and listening habits, continue recent listening, and catch new tracks from followed artists.
- Search Audius tracks, artists, and playlists with recent searches, type filters, and paginated results.
- Play music with one ordered queue, queue editing, playback recovery, and a paused session restore.
- Manage Audius favorites, follows, and playlists, including privacy, titles, descriptions, track order, and deletion.
- Generate a Vault mood mix and save it to your Audius library.
- Personalize discovery with device-local music preferences.
- View local listening history and statistics, and Audius notifications.
- Save music for offline listening on native platforms, with storage controls and a visible download queue, Wi-Fi waiting, retry, and cancellation.
- Use a persistent desktop web player with browser media commands, keyboard shortcuts, seeking, and volume.
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

Favorites, follows, and playlists belong to the listener's Audius account. Music preferences, listening history, cached data, and download settings live on the device or browser. Native OAuth sessions use SecureStore; web sessions use the current tab's `sessionStorage`.

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
