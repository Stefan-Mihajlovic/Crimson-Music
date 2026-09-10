# Security

Please report suspected vulnerabilities privately. Do not include secrets, exploit details, or other people's account data in public issues, pull requests, or logs.

## Reporting a vulnerability

If GitHub private vulnerability reporting is enabled for this repository, use **Security → Report a vulnerability**. Otherwise, use a private contact method explicitly listed on a maintainer's GitHub profile. If no private channel is available, open a non-sensitive issue requesting that private reporting be enabled; do not disclose the vulnerability there.

Include the affected revision, platform and build type, reproduction steps, potential impact, and a minimal demonstration using accounts and systems you control. Redact access tokens, refresh tokens, authorization codes, signing credentials, and personal data. Coordinate disclosure with the maintainer rather than posting details before a fix is available.

## Scope and expectations

This is an actively developed client, with iOS as the primary target and Android/web still experimental. There is no published long-term support schedule, guaranteed response time, or claim of a completed independent security audit. Report issues against the current development branch and identify the exact affected revision.

Relevant areas include OAuth callback validation, credential storage, account switching, authenticated request destinations, local data cleanup, dependency vulnerabilities, and native integrations. Issues in Audius itself should also be reported through Audius's own reporting channels.

See [dependency security status](docs/DEPENDENCY-SECURITY.md) for reviewed dependency alerts, applied fixes, and remaining limitations.

## Credentials and deployments

- `EXPO_PUBLIC_AUDIUS_API_KEY` is a public OAuth application identifier, not a secret. Register your own Audius application for your build.
- Every `EXPO_PUBLIC_*` value can be read from the distributed client. Never place private keys, app bearer secrets, listener tokens, or signing credentials there.
- Native listener sessions use SecureStore. Web sessions use `sessionStorage` and are accessible to scripts running on the same origin; protect hosted builds from script injection and untrusted third-party scripts.
- Keep Sentry upload tokens and signing material in private build secrets. A Sentry DSN identifies the receiving project and is not an upload credential.
- Use exact registered OAuth callback URLs and HTTPS for hosted web builds. Changing the native scheme requires matching source, app configuration, and Audius registration changes.

If a real secret is exposed, revoke or rotate it at its issuer. Removing it from the latest file does not remove it from repository history, existing builds, caches, or forks.

See [PRIVACY.md](docs/PRIVACY.md) for the data stored and transmitted by the current implementation.
