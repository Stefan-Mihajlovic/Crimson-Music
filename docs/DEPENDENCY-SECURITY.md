# Dependency security status

Reviewed **2026-09-10** against the committed dependency graph, installed caller source, official advisories/releases, and npm registry metadata. This is a targeted dependency review, not a full security audit. No application tests, builds, or exploit demonstrations were run locally. The lockfile was updated with lifecycle scripts disabled; CI and platform validation remain separate.

## Released fix applied: uuid

Path: `expo-splash-screen@57.0.8 → @expo/config-plugins@57.0.9 → xcode@3.0.1 → uuid@7.0.3`.

[GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) concerns buffer bounds in the `v3()`, `v5()`, and `v6()` APIs. Its fix was backported to [uuid 11.1.1](https://github.com/uuidjs/uuid/releases/tag/v11.1.1). The package files now override only `xcode`'s `uuid` dependency to that exact version.

The inspected `xcode/lib/pbxProject.js` uses `require('uuid')` and calls `uuid.v4()` without arguments, then formats the returned string as an Xcode identifier. It does not use the affected APIs or caller-provided buffers. Version 11.1.1 preserves this call and a [CommonJS export](https://github.com/uuidjs/uuid/blob/v11.1.1/package.json). This establishes source-level compatibility for the observed caller, not a completed native-build test. Remove the override when the upstream dependency range permits a patched release.

## Open: image-size parser loops

Path: `react-native@0.86.3 → @react-native/community-cli-plugin@0.86.3 → metro@0.84.4 → image-size@1.2.1`.

- [GHSA-w3rx-r6r6-pgpr / CVE-2025-71330](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr): malformed ICNS entries can prevent parser progress.
- [GHSA-5p2g-fcmc-qvqq / CVE-2025-71329](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq): malformed JXL/HEIF boxes can prevent parser progress.

Both advisories list releases through 2.0.2 as affected and no patched version. npm's latest release is 2.0.2, and the [upstream repository is archived](https://github.com/image-size/image-size). These alerts require a further fix beyond the earlier parser advisory addressed in 1.2.1.

The traced caller is Metro's Node-side `src/Assets.js`: `getAssetSize` passes project asset bytes to `image-size` during asset processing. No direct import was found in the application's `src/` tree. This trace identifies build/development tooling exposure; it is not a comprehensive shipped-bundle audit or a claim that every runtime path is unaffected. A malicious image added to the project can reach the parser under a recognized asset extension, so extension checks alone are not a mitigation.

Review contributed assets before processing them, keep development servers off untrusted networks, and retain bounded CI job timeouts. These measures limit exposure or duration; they do not repair the parser. Keep both alerts open pending a compatible upstream replacement or separately reviewed remediation. This change does not vendor a parser, introduce an unofficial fork, or upgrade Expo/React Native to another major version.

## Open: decode-uri-component

Path: `expo-router@57.0.20 → query-string@7.1.3 → decode-uri-component@0.2.2`.

[GHSA-vcc3-ghjq-m6fr / CVE-2026-45822](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) describes excessive work on malformed percent-encoded input. [Version 0.5.0](https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.0) is the published fix, but it is ESM-only. The installed `query-string` calls `require('decode-uri-component')` directly as a function, so a decoder-only override changes its expected module shape.

Upgrading `query-string` alone is also not a compatible drop-in: its newer [entry point exports a default object](https://github.com/sindresorhus/query-string/blob/v9.5.1/index.js), while Expo Router 57's inspected path/query helpers use namespace imports and call `queryString.parse` and `queryString.stringify`. The decoder therefore remains unchanged in this focused fix.

Malformed query strings are a routing concern, unlike Metro's asset-processing path. No new in-app mitigation is claimed here. The advisory recommends limiting input size; adding a routing boundary guard, a supported CommonJS backport, or a coordinated Router/module migration requires a separate compatible implementation and validation. Keep the alert open rather than masking it with an incompatible override or dismissing it.
