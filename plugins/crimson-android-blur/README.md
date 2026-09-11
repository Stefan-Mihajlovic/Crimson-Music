# Android frosted glass adapter

`with-android-frosted-glass.js` patches the pinned Expo Blur 57.0.3 source during Android prebuild. `expo-blur` must be listed in `expo.autolinking.android.buildFromSource`; otherwise Expo would package the unmodified prebuilt module.

On the Moto G5 Plus (Android 8.1), replacing blur instances caused Dimezis BlurView 3.1.0's cached RenderScript context to become invalid (`Calling RS with no Context active`). Repeated full-hierarchy captures for every button also delayed rendering. On Android 7–11, `CrimsonLegacyBlurView` shares one downsampled capture and independently owned `RenderScript.createMultiContext` context per target. Hidden/clipped controls do not request captures; the final client detaching releases the observer, bitmap references, and native allocations. Capturing excludes other blur views to avoid feedback. Input/output allocations are reused until dimensions change.

Legacy captures are cropped to the visible controls' combined bounds plus blur padding, and leave at least 50 ms between processing passes for input and animation. They follow content invalidation instead of running a background timer. Android 12+ retains the library's RenderNode path. Noise and the stock tint are omitted: the intended material is the original surface color at 80% opacity over blur, without decorative texture, highlights, or an extra light/dark wash. Web uses plain CSS `backdrop-filter: blur(...)` with the same color; no saturation adjustment is applied.

The patch is version guarded and idempotent. Revisit it with Expo Blur upgrades. Native builds and device runtime checks are necessary; JavaScript tests alone do not exercise the RenderScript lifecycle.

The 57.0.2 → 57.0.3 upgrade was checked against the published npm packages: Android and TypeScript source files are unchanged, and Dimezis remains at 3.1.0. Only the Android module's version metadata changed.

Sources: [Expo BlurView](https://docs.expo.dev/versions/latest/sdk/blur-view/), [Dimezis BlurView](https://github.com/Dimezis/BlurView), [Android RenderScript context API](https://developer.android.com/reference/android/renderscript/RenderScript#createMultiContext(android.content.Context,%20android.renderscript.RenderScript.ContextType,%20int,%20int)).
