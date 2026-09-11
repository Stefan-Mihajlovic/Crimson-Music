export const BROWSE_TILE_GAP = 10;
export const BROWSE_TILE_HEIGHT = 96;
export const BROWSE_TILE_RADIUS = 18;
export const BROWSE_PAGE_INSET = 20;

export const browseTileWidth = (screenWidth: number) =>
  (screenWidth - BROWSE_PAGE_INSET * 2 - BROWSE_TILE_GAP) / 2;
