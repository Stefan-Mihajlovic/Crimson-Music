# iPhone native tabs adapter

Reapplied by the Expo iOS config plugin and `npm postinstall` (via
`scripts/fix-expo-ios-paths.js`). Pinned to react-native-screens 4.26.2; review this
adapter when upgrading the dependency. No changes to generated native projects
or dependency files need to be committed.

- iPhone / iOS 27: installs the same RN screen controllers using `UITab` and a
  trailing `UISearchTab`. The search tab is explicitly prominent, so it remains
  separate when the bar minimizes. Selection, repeated taps, programmatic
  navigation and asynchronous artwork updates stay connected to RN Screens.
  RN bookkeeping uses separate helpers; UIKit's controller getters are never
  overridden, so initial selected-tab containment can finish on a cold launch.
- iPhone / iOS 26+: `bottomAccessoryHidden` removes the complete system accessory
  via `setBottomAccessory:nil animated:NO`. UIKit renders its glass outside the
  content view, so hiding that view's layer is insufficient. The pan recognizer
  lives on the stable app host, measures the current regular/inline bounds at
  touch-down, and continues tracking after the native accessory is detached.
  The accessory is restored when the morph finishes, including cancelled drags.
- iPad and older iOS retain the original implementation. Android and web are
  unaffected.

No private selectors or private UIKit class names are used.

Context: https://github.com/software-mansion/react-native-screens/issues/4671
Public APIs: `UITab`, `UISearchTab`, `UITabBarController.prominentTabIdentifier`.

Validation on Stefan's iPhone 16 Pro (iOS 27.2.1): switching Search/Home,
scrolling into the inline accessory, opening from inline and regular placement,
and returning to the accessory. The integration suite covers platform guards,
visibility ownership and cancelled gestures; it does not simulate UIKit.

The iPhone fullscreen morph has one glass surface whose bounds grow from the
accessory frame. Mini controls are children of that surface, without a second
fixed-size capsule. Verified Home after two cold launches without switching tabs.

The handoff starts with `CrimsonRemoteControls.beginPlayerTransition`. It samples
Core Animation presentation bounds and logical content dimensions, covers only the
source capsule with a cropped UIKit snapshot, and removes the native accessory in the
same main-thread transaction. The replacement starts at that exact frame and
keeps the native content scale, including the pressed glass deformation.

`finishPlayerTransition` releases the snapshot only after replacement layout and
artwork display, with no opacity crossfade between translucent surfaces. Movement
accumulated during mounting is recovered over 80 ms, rather than discarded as a
dead zone. Closing starts with the unpressed touch-down frame, then measures
UIKit's current destination every 50 ms while settling. The retained accessory
participates in a layout-only main-thread transaction and is removed before
compositing, so neither a second capsule nor a whole-navigation snapshot appears.
Bounds, artwork and regular/inline controls interpolate together when scrolling
changes the destination. A final measurement and both geometry/travel completion
are required before restoring the native accessory. Late results from an
interrupted close are ignored, and retained native references are released at
completion. Closing uses mass 1.05 and stiffness 190 for a slightly longer return.
Release velocity controls closing damping and momentum, with visible overshoot
bounded to 12 pt. Opening retains its original clamped 190/26.5 spring curve.
The tab bar stays live and is never covered by the snapshot, avoiding a second
composited copy of its glass during handoff. Finger tracking and the initial handoff stay
unchanged, and Reduce Motion skips the spring.
Fast releases wait for readiness before settling. Unmount cancels a pending
handoff. A fresh morph instance on each opening avoids Reanimated reusing an old
regular-width initial style for the compact accessory.

Static faded text is present from its first layout; it does not wait for marquee
measurements. Inline controls retain the artist and horizontal song pager.

Verification: native Release builds, typecheck/lint, 30 integration regressions,
and simulator video frame inspection of regular/inline opening and short-drag
cancellation. The simulator uses a temporary local fixture account and paused
song outside shipped source. The final device build uses normal authentication;
regular/inline opening and returning were also exercised on Stefan’s iPhone.

The moving surface accepts taps and pans throughout settling, including its
final rebound. Native hit testing uses the current visible card in window
coordinates; fullscreen controls retain their own gestures. A new interaction
cancels both travel and frame-restoration animation, and invalidates the old
completion callback. Native dismiss/reopen intent uses 72 pt of projected travel
(translation plus 180 ms of velocity), with an 8 pt accidental-motion guard.
