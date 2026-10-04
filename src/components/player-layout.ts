export const MINI_PLAYER_HEIGHT = 52;
// Match the floating four-item iPhone tab bar and its Performance Mode variant.
export const BOTTOM_BAR_HORIZONTAL_INSET = 20;

// Browser chrome shares these dimensions with the expanded-player morph.
export const WEB_BOTTOM_BAR_INSET = 10;
export const WEB_TAB_BAR_HEIGHT = 56;
export const WEB_PLAYER_TAB_GAP = 6;
export const webTabBottom = (safeBottom: number) => Math.max(8, safeBottom);
export const webMiniPlayerBottom = (safeBottom: number) => webTabBottom(safeBottom) + WEB_TAB_BAR_HEIGHT + WEB_PLAYER_TAB_GAP;
