# App icon and artwork

The live Apple icon source is `assets/Crimson.icon`, containing `icon.json` and two SVG note layers. Icon Composer supplies the material, lighting, and system mask. Android and web assets use the same geometry.

| Asset | Use |
| --- | --- |
| `assets/Crimson.icon` | Layered iOS app icon; configured as `ios.icon` |
| `assets/images/icon.png` | Opaque 1024 × 1024 Expo/Android legacy icon and in-app brand mark |
| `assets/images/android-icon-background.png` | Android adaptive background, with configured color `#281146` |
| `assets/images/android-icon-foreground.png` | Transparent, padded Android adaptive mark |
| `assets/images/android-icon-monochrome.png` | Android themed-icon silhouette |
| `assets/images/splash-icon.png` | Transparent splash mark, displayed at width 180 over `#281146` |
| `assets/images/favicon.png` | 48 × 48 web favicon |
| `assets/images/auth/crimson-logo.webp` | Rasterized wordmark used by `BrandLogo`; no wordmark font file is bundled |
| `assets/images/favorites/heart-matte.png` | Static Favorites cover |
| `assets/images/local-music/cover-matte.png` | Static Local Music cover |

## Updating assets

Edit the live Composer document and refresh the corresponding raster assets from the same geometry. Keep an opaque PNG in Expo's root `icon` setting and `.icon` in `ios.icon`. Android adaptive foreground and monochrome layers must fit within the central 66 dp safe circle on a 108 dp canvas, without a baked launcher mask.

Favorites and Local Music use `BuiltInCollectionArtwork` through their shared cover components. Preserve proportional thumbnail cropping and contained hero scaling; do not substitute a fixed-size glyph.

After changing native configuration, regenerate native resources with Expo and run `node scripts/fix-expo-ios-paths.js` after the final iOS prebuild. Re-export web to refresh its bundled icon and favicon. See [platform build instructions](PLATFORMS.md).

This Icon Composer 2.0 document uses refractivity and requires Xcode 27 or newer. That compiler requirement does not raise the app's iOS deployment target. CI compiles the icon before the application build; native installation and appearance still need separate checks.
