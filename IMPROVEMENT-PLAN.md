# Crimson Audius client

Crimson now uses Audius OAuth for listener identity and the listener's bearer token for music and library operations. The public Audius app identity is required only to identify Crimson during OAuth. There is no Crimson account registration, password database or Firebase backend.

## Retained reliability work

- Bound and deduplicate catalog requests; enforce network deadlines.
- Render Home progressively and virtualize large Library, Favorites and Playlist lists.
- Prevent stale account/profile requests and pending playback/download work from crossing account changes.
- Handle native reachability, reconnect and background transitions.
- Keep playback preferences and device storage local.
- Preserve Data Saver, reduced-motion behavior, background playback and native remote controls.

## Current release validation

Run the static, unit and integration checks described in [release validation](docs/RELIABILITY-RELEASE.md). Use a freshly rebuilt native app for Audius OAuth, library read/write and playback checks. Previous measurements and backend emulator test counts do not apply to the new data flow.

Physical-device verification still needs a real Audius authorization and callback, account switching, library updates, lock-screen controls, interruptions, offline recovery, accessibility and background battery checks. Optional Sentry reporting remains disabled without a configured DSN.

This repository no longer deploys a backend. Removing its old integration does not delete previously deployed cloud resources or alter another application's data.
