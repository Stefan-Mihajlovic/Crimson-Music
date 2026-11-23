# Dependency security status

Review date: **2026-11-23**. The updated lockfile reports **zero known vulnerabilities** with `npm audit`, including development dependencies. This is a point-in-time dependency check, not a guarantee that the application has no security defects.

## Applied fixes

| Package | Locked version | Fix |
| --- | --- | --- |
| shell-quote | 1.12.0 | Rejects line terminators after comment tokens ([advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv)). |
| image-size | 2.1.0 | Bounds parser progress for malformed [ICNS](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) and [JXL/HEIF](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) input. |
| decode-uri-component | 0.5.1 | Fixes both [exponential decoding](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) and [quadratic replacement](https://github.com/advisories/GHSA-qr28-fpjm-wq7f). |
| minimatch (affected 7–10 releases) | 11.0.9 | Fixes [globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249). Unaffected legacy 3.x callers retain their callable CommonJS API. |
| brace-expansion | 1.1.22 / 5.1.0 | Fixes [quadratic expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) and recursion exhaustion. |
| zod | 4.6.7 | Fixes [oversized constrained collection validation](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). |

## Compatibility boundaries

Expo SDK 57 and React Native remain on their existing versions. Scoped npm overrides provide the patched dependencies without upgrading the native SDK.

Metro passes asset bytes to the default `image-size` export. Version 2.1.0 retains that API; tests exercise Metro's actual `getAssetSize` against app artwork and reject malformed container headers in a timeout-bounded child process. Filesystem-based APIs removed in image-size 2 are not used by the installed Metro caller.

Expo Router 57 uses `query-string@7.1.3`'s named parse/stringify API. Its decoder is now ESM-only. The repeatable postinstall adapter in `scripts/lib/dependency-compat.cjs` selects the decoder's default export, preserving query-string's public API. It checks the exact caller version and fails on an unknown import instead of silently leaving an incompatible install. Node 24 supports the synchronous ESM import, and Metro handles it in native/web bundles. No decoder implementation is vendored or rewritten. Remove this adapter and override when upgrading to a Router version that no longer needs them.

The minimatch override only targets affected majors 7–10, whose object exports match the upgraded API. The lockfile retains minimatch 3 for older ESLint/Jest callers. Existing `qs` and `xcode → uuid@11.1.1` security overrides remain in place.

## Verification

Use `npm ci`, `npm audit`, `npm run check`, `npm test`, `npx expo-doctor`, and production exports/builds when revisiting these overrides. `tests/dependency-security.test.mjs` covers Router query compatibility and malformed input, Metro asset parsing, shell quoting rejection, and glob matching. Keep Dependabot enabled; do not dismiss alerts to hide an unresolved dependency.
