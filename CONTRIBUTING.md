# Contributing to Crimson Music

Crimson is an independent Audius client. Contributions should preserve direct Audius sign-in, keep account actions tied to the signed-in listener, and respect the platform limitations in [PLATFORMS.md](docs/PLATFORMS.md).

## Set up

1. Fork and clone the repository.
2. Use Node.js 24 and run `npm ci`.
3. Copy `.env.example` to `.env` and configure your own public Audius app key and registered callbacks as described in the [README](README.md).
4. Start your chosen target with `npm run ios`, `npm run android`, or `npm run web`.

Keep `.env`, tokens, signing files, device logs, and personal screenshots out of commits. Do not use another contributor's Audius application registration or credentials.

## Propose a change

Use an issue to discuss substantial changes before implementing them. For a bug, include the platform, OS/browser version, build type, reproduction steps, expected result, and observed result. Redact account details, OAuth URLs, tokens, and private content from logs or screenshots. Security vulnerabilities belong in the private workflow in [SECURITY.md](SECURITY.md).

Keep pull requests focused. Explain the problem, resulting behavior, affected platforms, validation performed, and any remaining limitations. A small fix does not need an unrelated refactor. Include asset provenance and license information when adding media, and update the documentation when behavior or configuration changes.

## Source conventions

- Follow nearby TypeScript and React Native patterns. Put platform-specific behavior in platform modules where practical.
- Preserve cancellation and account-change guards around asynchronous requests and local writes.
- Keep authentication tokens out of logs, analytics, public URLs, and third-party media requests.
- Preserve accessibility labels, system and app Reduce Motion behavior, and Performance Mode fallbacks.
- Edit canonical native sources in `plugins/` and reproducible patches in `scripts/`. Generated `ios/` and `android/` changes alone will not survive prebuild.
- Use npm and update `package-lock.json` when changing dependencies.

## Validation

Available checks are:

```bash
npm run check
npm run test:unit
npm run test:integration
npx expo-doctor
```

Run checks relevant to the change and record their results in the pull request. If a check was not run, say so. Add or update meaningful tests for behavioral fixes; do not add tests that merely repeat implementation details.

Native changes require rebuilding the app. Real OAuth, playback interruptions, background audio, downloads, accessibility, and browser behavior also need validation on their affected targets. Automated checks alone do not establish platform parity. The [release checklist](docs/RELIABILITY-RELEASE.md) describes the broader release work.

## Licensing

Contributions to the project code are made under the existing [MIT License](LICENSE). Only submit material you have permission to contribute, retain required notices, and document third-party assets in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
