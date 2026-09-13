export type WelcomeArtworkOptions = { signal?: AbortSignal; dataSaver?: boolean };

type Artwork = { regular: string; small: string };
const endpoint = 'https://api.audius.co/v1/tracks/trending?limit=24';
const cacheTtl = 60 * 60 * 1000;
let cache: { artwork: Artwork[]; expiresAt: number } | undefined;

function httpsImage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.href;
  } catch { return undefined; }
}

function parseArtwork(payload: unknown): Artwork[] {
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) return [];
  const artwork: Artwork[] = [];
  for (const track of payload.data.slice(0, 24)) {
    if (!track || typeof track !== 'object' || !track.artwork || typeof track.artwork !== 'object') continue;
    const small = httpsImage(track.artwork['150x150']);
    const medium = httpsImage(track.artwork['480x480']);
    const large = httpsImage(track.artwork['1000x1000']);
    const regular = medium || small || large;
    if (regular) artwork.push({ regular, small: small || regular });
  }
  return artwork;
}

function selectImages(artwork: Artwork[], dataSaver = false) {
  return [...new Set(artwork.map((image) => dataSaver ? image.small : image.regular))];
}

/** Public artwork for the signed-out welcome screen; never uses account credentials. */
export async function getWelcomeArtwork({ signal, dataSaver = false }: WelcomeArtworkOptions = {}): Promise<string[]> {
  if (signal?.aborted) return [];
  if (cache && cache.expiresAt > Date.now()) return selectImages(cache.artwork, dataSaver);

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 8000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok || controller.signal.aborted) return [];
    const artwork = parseArtwork(await response.json());
    if (controller.signal.aborted) return [];
    if (artwork.length) cache = { artwork, expiresAt: Date.now() + cacheTtl };
    return selectImages(artwork, dataSaver);
  } catch {
    // The bundled welcome artwork remains visible offline or during API failures.
    return [];
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
