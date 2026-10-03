export const BROWSE_TILE_GAP = 10;
export const BROWSE_TILE_HEIGHT = 96;
export const BROWSE_TILE_RADIUS = 18;
export const BROWSE_PAGE_INSET = 20;

export const browseTileWidth = (screenWidth: number) => {
  const columns = screenWidth >= 1100 ? 6 : screenWidth >= 700 ? 4 : 2;
  return (screenWidth - BROWSE_PAGE_INSET * 2 - BROWSE_TILE_GAP * (columns - 1)) / columns;
};
