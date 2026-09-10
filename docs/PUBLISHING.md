# Publishing the source

This repository is prepared as an independent, community-developed Audius client. The source release is a development preview: publishing the code does not mean Android, iOS, and web have complete feature parity or that every platform has been release-tested. See [platform support](PLATFORMS.md).

## Repository contents

- Application code and the existing MIT license.
- Locked dependencies, Node 24 setup, and portable native build configuration.
- Contributor instructions, security policy, issue forms, pull-request template, and GitHub Actions workflow.
- Artwork credits in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
- Privacy and device-storage behavior in [PRIVACY.md](PRIVACY.md).

`.env`, signing material, generated `ios/` and `android/` projects, build outputs, and private audit material are ignored. Commit `.env.example` with empty values. Contributors register their own Audius application and configure a public app identity; listener tokens are obtained by OAuth.

`package.json` intentionally has `private: true`: that prevents accidental npm publication and does not restrict a public GitHub repository.

## Public source history

The public repository starts with a clean source snapshot of the Audius client. Earlier development commits, Firebase/Google configuration, local environment files, signing material, and private audit files are not imported. The earlier development repository remains private.

Do not merge branches or push tags from the earlier development repository into this repository: doing so could reintroduce its history. Port future changes as reviewed patches from the public baseline. Keep any old cloud credentials and their revocation/restrictions separate from source publication; a clean Git history does not revoke a credential at its provider.

## Before publishing new source

Review the exact tracked files and all commits being pushed for credentials and private configuration. Deleting a file from the latest tree does not remove earlier versions. If sensitive material was committed to a public repository, revoke the credential first and follow GitHub's [history-removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository), including cached views and pull-request references. Do not treat a source scan as a comprehensive security audit or proof of cloud configuration.

Once the prepared changes are on GitHub:

1. Enable the dependency graph and Dependabot alerts.
2. Let the Quality workflow run before setting its `checks` job as a required pull-request status. A configured workflow is not evidence that it has passed.
3. Protect `main` against deletion and force pushes, and require pull requests with the successful `checks` status. Do not require another person's approval while the project has only one maintainer.
4. Set a description such as **Independent open-source Audius music player for iOS, Android and web**. Suggested topics: `audius`, `music-player`, `expo`, `react-native`, `ios`, `android`, `web`.

### Immediately after making the repository public

GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository) is a feature for public repositories. [Secret scanning](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enable-secret-scanning) is available for public repositories; private repository availability depends on the owner and plan. A personal private repository may not offer these options; verify them on the public repository after publication.

1. Enable private vulnerability reporting so the contact path in `SECURITY.md` is available.
2. Enable secret scanning and push protection, and review the initial scan results, including legacy history.
3. Confirm the `main` ruleset is active and enforced for the public repository.

Repository visibility, remote history, branch protection, and GitHub account settings are not changed by local source edits. App Store/Play Store submissions, signing, and web hosting are separate release operations.

## Binary releases

Use the [release validation guide](RELIABILITY-RELEASE.md) before distributing a binary as stable. Keep signing keys and source-map upload tokens in private build credentials. Publish a platform-specific release note stating what was actually built and exercised; do not present a successful iOS build as Android or browser validation.
