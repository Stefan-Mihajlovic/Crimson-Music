# Crimson app icon

Stefan selected **04 Sonata** on 2026-09-13: two opposing, slightly tilted notes on deep purple. The selected design is now applied to the production source assets and `app.json`. The other candidates remain in the [design archive](../design/icon-exploration/README.md).

## Sources and uses

The live editable Apple source is [`assets/Crimson.icon`](../assets/Crimson.icon), containing `icon.json` and two separate SVG layers. It matches the approved [`Crimson-Sonata.icon`](../design/icon-exploration/candidates/04-sonata/Crimson-Sonata.icon) document. Icon Composer supplies the iOS material, lighting, and system mask; portable assets use the same vector geometry.

| Production source | Use |
| --- | --- |
| `assets/Crimson.icon` | `ios.icon`; Expo copies it into the generated Xcode project and sets the primary app-icon name to `Crimson` |
| `assets/images/icon.png` | Opaque 1024 × 1024 root Expo icon, Android legacy icon, desktop sidebar, and fallback playlist-cover badge |
| `assets/images/android-icon-background.png` | Full-square Android adaptive background; configured background color is `#281146` |
| `assets/images/android-icon-foreground.png` | Transparent, padded Android adaptive mark |
| `assets/images/android-icon-monochrome.png` | White alpha silhouette for Android themed icons |
| `assets/images/splash-icon.png` | Transparent mark used by `expo-splash-screen`, at image width 180 over `#281146` |
| `assets/images/favicon.png` | 48 × 48 web favicon |
| `assets/images/auth/crimson-logo.webp` | Transparent 1146 × 300 wordmark through `BrandLogo`, used on welcome and final onboarding screens |

The wordmark uses **Helvetica Neue**, weight 500, rasterized at export: CRIMSON is 164 px and MUSIC is 121 px on the source canvas. It pairs the native Sonata preview with a light title and a violet gradient subtitle. No font file is bundled for the wordmark. Its production WebP is a lossless conversion of the staged PNG; decoded alpha and all visible pixels were verified identical.

Account images remain the listener's Audius photo or an existing scenery preset. Native account-tab loading uses a `person.fill` placeholder. Those are not application branding and were not replaced.

## Android padding

The adaptive icon keeps background, foreground, and monochrome layers separate, without a baked launcher mask. The exporter fits the entire mark inside the central **66 dp circle on a 108 dp canvas**, reserving another 8 px on the 1024 px source for edge antialiasing. Sonata's scale is approximately **0.826532**; its measured alpha radius is **304.901 px**, below the **312.889 px** safe radius. Exact values are recorded in the [staged manifest](../design/icon-exploration/candidates/04-sonata/platform-assets/manifest.json).

## Updating the design

The [platform exporter](../design/icon-exploration/scripts/export-platform-assets.cjs) generates candidate SVG/PNG assets under `design/icon-exploration/candidates/*/platform-assets`; it does not promote them into production. After an approved edit, synchronize the selected Composer document and generator, regenerate previews and portable assets, then update the corresponding production files above. Preserve the other proposals as design history.

Keep `.icon` in `ios.icon` and an opaque PNG in the root `icon` setting. Regenerate native resources with Expo after configuration changes, and run `node scripts/fix-expo-ios-paths.js` after the final iOS prebuild. Clean prebuilds recreate the native project, so preserve the existing bundle identifier and supply local signing settings separately. Re-export the web app to refresh its bundled logo and favicon.

Building this Icon Composer 2.0 document requires Xcode 27 or newer because its `refractivity` feature is not supported by Xcode 26.6. CI uses the `xcode-27` runner and performs a real `actool` icon compilation before the full application build. Merely reading asset tags does not detect the incompatible older compiler.

The selected document passed isolated Xcode 27 asset compilation for an iPhone target with minimum iOS 16.4, including valid light, dark, and tintable icon stacks. Full application builds, installation, and device appearance are separate verification steps; asset validation alone does not establish them.
