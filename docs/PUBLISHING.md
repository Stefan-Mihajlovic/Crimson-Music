# Publishing source and builds

Crimson is an independent Audius client. Describe the supported targets and limitations in [PLATFORMS.md](PLATFORMS.md), and report the platforms actually exercised in each release.

## Source contents

Publish application code, locked dependencies, portable native configuration, contributor guidance, and required license notices. Keep `.env`, listener tokens, signing material, generated native projects, build output, personal screenshots, and local work logs out of commits. `.env.example` contains empty values; contributors register their own Audius application.

`package.json` uses `private: true` to prevent accidental npm publication. This does not restrict public source hosting.

Review the exact files and commits being pushed for private configuration. Do not import private development history without reviewing it. Deleting a secret from the current tree does not remove previous versions or revoke it: rotate exposed credentials and follow GitHub's [history-removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

Preserve [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) and the [MIT license](../LICENSE). Update [PRIVACY.md](PRIVACY.md) if a fork changes storage, telemetry, or network services.

## Repository settings

- Enable the dependency graph and Dependabot alerts; review the compatibility notes in [DEPENDENCY-SECURITY.md](DEPENDENCY-SECURITY.md).
- Enable [private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository) and available secret-scanning/push-protection features. Keep [SECURITY.md](../SECURITY.md) consistent with the available contact path.
- Protect the main branch from deletion and force pushes, require pull requests, and make the Quality workflow's `checks` job required after confirming it runs successfully.

## Binary and web releases

Follow the [release validation guide](RELIABILITY-RELEASE.md). Native changes need rebuilt applications; configure distribution signing and the correct app identifiers before store distribution. Keep signing keys and source-map upload tokens in private build credentials.

Hosted web builds need HTTPS, working direct navigation to `/oauth/callback`, and the exact callback origin registered with Audius. Set the public build configuration before export. Publish release notes with the tested revision, platforms, and material limitations.

### Netlify

The existing project is `crimsonmusic` at https://crimsonmusic.netlify.app. Connect it to `Stefan-Mihajlovic/Crimson-Music` (the repository name includes a hyphen), using the `main` production branch and the repository root as the base directory.

`netlify.toml` selects Node.js 24, runs `npm run build:web`, and publishes `dist/`. Set `EXPO_PUBLIC_AUDIUS_API_KEY` to the public Audius app key in Netlify's build environment. Register `https://crimsonmusic.netlify.app/oauth/callback` with the same Audius application. Never upload `.env` or private credentials.

For a manual release of local changes, run `npm run build:web` with the public key configured locally and upload only `dist/` to the existing Netlify project's Deploys page. This includes local changes that have not been pushed to GitHub. Subsequent Git-based deployments use the files committed and pushed to the production branch.
