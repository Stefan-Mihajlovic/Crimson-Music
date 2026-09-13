# Crimson icon integration plan

Inspected against the working tree on 2026-09-13. The selection stage deliberately leaves the current app icon and app code unchanged. Apply this plan after Stefan chooses a design.

## Source and native tooling

- Xcode selected by `xcode-select -p`: `/Applications/Xcode-beta.app/Contents/Developer`.
- Icon Composer app: `/Applications/Xcode-beta.app/Contents/Applications/Icon Composer.app`.
- **Rendering CLI:** `/Applications/Xcode-beta.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool`. Its `--help` is supported, and `--version` reports version `2.0`, build `118`.
- `xcrun ictool` resolves to a different executable in `Developer/usr/bin`; its `--help` and `-h` return errors. Use the app's executable for preview export.
- The system-provided iOS document template is at `.../Contents/Developer/Platforms/iPhoneOS.platform/Developer/Library/Xcode/Templates/File Templates/iOS/Resource/Icon Composer Icon.xctemplate/___FILEBASENAME___.icon/icon.json`.
- `.icon` is an editable directory: `icon.json` plus an `Assets` directory containing individual SVG or raster layers. Keep the layers, rather than flattening a preview and calling it an Icon Composer document.

Documented export command (paths are examples, use the selected design's actual path):

```sh
ICON_RENDER_TOOL='/Applications/Xcode-beta.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool'
"$ICON_RENDER_TOOL" 'design/icon-exploration/Selected.icon' \
  --export-image --output-file '/tmp/crimson-icon-preview.png' \
  --platform iOS --rendition Default --width 1024 --height 1024 --scale 1 \
  --design-generation 26
```

The CLI help also documents `TintedDark`, `--tint-color 0.25`, `--tint-strength 0.75`, and `--design-generation 27`. Validate any additional rendition names by successful exports before promising those previews. The GUI should be used to inspect the actual editable document and its materials.

## Expo support already installed

Current Expo is `~57.0.22`. The installed `@expo/config-types/build/ExpoConfig.d.ts` explicitly accepts a `.icon` directory as a **string** in `ios.icon`. `@expo/prebuild-config/build/plugins/icons/withIosIcons.js` implements this by copying the directory into `ios/CrimsonMusic`, adding it to Xcode resources, and setting `ASSETCATALOG_COMPILER_APPICON_NAME` to its basename.

Use `ios.icon: "./assets/Crimson.icon"` for the chosen editable source. Keep root `expo.icon` as a flattened PNG; the plugin warns against placing `.icon` at the root `icon` key or inside an appearance object.

Generated `ios/`, `android/`, `dist/`, `.expo/`, and `.build/` are gitignored. Update source assets and `app.json`, then regenerate native outputs through Expo; changing only generated resources is not durable.

## Exact replacement map after selection

| Current source / configuration | Surfaces affected | Selected-design replacement |
| --- | --- | --- |
| `assets/images/icon.png` (1024 × 1024), root `expo.icon` | Legacy launcher icon; in-app fallback playlist badge; desktop sidebar | Opaque, full-square 1024 PNG export of chosen icon, with no baked iOS rounded-corner mask |
| `app.json` → `ios.icon` currently points to that PNG | iOS launcher, system app identity | `assets/Crimson.icon` with genuine editable layers, then Expo prebuild |
| `app.json` → `android.adaptiveIcon.foregroundImage` currently points to full icon PNG | Android adaptive launcher | New transparent standalone mark with adaptive-mask padding; set `backgroundColor` or `backgroundImage` separately |
| `app.json` → `android.adaptiveIcon.backgroundColor` currently `#17070D` | Android launcher background | Chosen deep-violet / near-black background |
| No Android `monochromeImage` currently | Android themed launcher | Export a clean single-color alpha silhouette of selected mark and configure it; installed Expo plugin implements this |
| `assets/images/favicon.png` (48 × 48), `web.favicon` | Web browser tab icon | Rasterize a simplified selected mark at small size; regenerate static web output |
| `app.json` → `expo-splash-screen` image and background | iOS/Android launch screen | Chosen mark PNG and matching background; preserve intentionally small 180 logical-pixel presentation unless design review warrants adjustment |
| `assets/images/auth/crimson-logo.webp` (1146 × 300) via `src/components/brand-logo.tsx` | Welcome screen and final onboarding panel | Replace old mark inside the wide Crimson Music wordmark; preserve a wide composition and inspect current 272 × 88 / 244 × 80 placements |
| `src/components/playlist-cover.tsx` | Fallback mosaic playlist art | Automatically updates with `icon.png`; inspect center badge at 27% cover width because current container is circular with a white border |
| `src/components/web-app-shell.web.tsx` | Desktop sidebar brand, displayed at 34 × 34 | Automatically updates with `icon.png`; inspect compact rendering |

The six local avatar presets are scenery illustrations, **not** old Crimson logos. The account tab uses `ProfilePhoto` (preset `1` by default or a remote user image). Its native loading placeholder is a generated `person.fill` icon. Keep those and all custom/remote account photos unchanged; an old logo visible as a user's uploaded profile photo is user content, not the application's icon asset.

## Verification and cleanup

1. Keep all proposal documents and previews until the user chooses. Preserve existing unrelated working-tree changes and historical asset deletions.
2. Open selected `.icon` in Icon Composer and inspect its layers, normal/dark/tinted appearances, mask edges, and 32–64 px legibility.
3. Regenerate native assets using the project's established Expo prebuild flow. Check the copied `.icon`, Xcode app-icon build setting, Android adaptive XML and monochrome layer, splash assets, and generated web favicon.
4. Inspect welcome/onboarding wordmark, desktop sidebar, and playlist fallback so old embedded brand artwork is not left behind. Use source-reference searches before removing any replaced file; generated output should be rebuilt rather than retained as a second source.
5. Run project checks appropriate to configuration/assets (`npm run check`; existing tests if source components change), create the Release build, install onto Stefan's iPhone 15 Pro using the existing paired-device workflow, and verify the new home-screen icon. Report build/install success only from command/device evidence.

The user has requested a choice of variants first. Installing a particular new design depends on that choice; do not silently select one on their behalf.
