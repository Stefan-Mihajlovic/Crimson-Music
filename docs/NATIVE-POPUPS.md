# Native popup layout

Native popups use the root stack's `formSheet` presentation. `ResponsivePopup` adds no native view on iOS; Android retains its frosted surface and web retains its portal.

On iOS, give `PopupSheetLayout` a render function whose result is one direct `ScrollView` or `FlatList`. Insert the supplied `inlineHeader` into the scroll content or `ListHeaderComponent`, before the controls or rows. The heading and all content then share one coordinate system when UIKit resizes the native scroll view. Keep horizontal padding in the content or individual rows, not outside the scrolling root. Android and web receive a null inline header and retain the ordinary fixed header above their flex scroll area.

Keep the header inside the scrolling root. Separate sibling headers and fixed top spacers can overlap content when UIKit corrects sheet frames; structural React tests alone cannot establish correct native positioning.

Filters, all filter option lists, Add to playlist, and the playlist editor use the same single-scrolling-root approach on iOS. Player details already keeps its heading inside scrolling content. The integration tests check the content relationship and behavior; native resizing must also be checked on a device.

## Background page headers

Main headers use `FullWindowOverlay` on iOS so their title/actions stay clear of the native navigation bar. Opening a sheet blurs the source page but does not navigate away from it. `isMainHeaderBehindPopup` follows the selected route underneath known popup entries. Read the fully hydrated `navigationRef.getRootState()` and subscribe to its state events: Expo's `useRootNavigationState()` returns a shallow snapshot that omits the nested page and can update before the blur transition commits. While that page is covered, `MainHeaderOverlay` shows a noninteractive header in the page scene and clips its window overlay. UIKit can then dim and cover the header along with the rest of the page. Dismissal restores the interactive window header. Changing tabs or opening ordinary details does not revive covered page headers.

## Device verification

- Open Search → Filters without touching the grabber: the title precedes Genre/Mood/Key, and the Search header remains visible behind the dimmer.
- Open Genre, Mood, and Musical key: Any begins below the title. Expand and contract the sheet; return to the main controls.
- Expand the player → song menu → Add to playlist: Favorites begins below Back, Add to playlist, and Done, both on first opening and at either detent. Repeat from a regular song row and with a local file.
- Open Edit playlist: the name, description, and tracks follow the heading. Exercise keyboard resizing and cancel without changing user data.
- Dismiss popups and confirm page headers/actions return without duplication. Navigate to another tab and a real detail page to confirm the old header is not left over it.
