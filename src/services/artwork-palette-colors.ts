export type ArtworkPalette = readonly [string, string, string];

// Sampled from the bundled assets/images/home/default-song.webp at 40×40 using
// the same quantized dominant-color ranking as web extraction. This asset is
// what every player shows for missing/unavailable covers; no network is needed.
export const fallbackArtworkPalette: ArtworkPalette = ['#30084B', '#92106A', '#570C8F'];
