import { Image } from 'react-native';
import { imageArtworkCandidates, isFailedArtwork, markArtworkFailed, markArtworkLoaded } from '@/services/artwork-fallback';
import type { CrimsonSong } from '@/types/music';

const imageCache = new Map<string, string>();
const pendingImages = new Map<string, Promise<string>>();
let cacheBytes = 0;
const MAX_CACHE_BYTES = 20 * 1024 * 1024;

function rememberImage(uri: string, data: string) {
  const old = imageCache.get(uri);
  if (old) cacheBytes -= old.length;
  imageCache.delete(uri);
  imageCache.set(uri, data);
  cacheBytes += data.length;
  while (cacheBytes > MAX_CACHE_BYTES || imageCache.size > 40) {
    const key = imageCache.keys().next().value!;
    cacheBytes -= imageCache.get(key)!.length;
    imageCache.delete(key);
  }
}

function decodedImage(uri: string): Promise<string> {
  const cached = imageCache.get(uri);
  if (cached) { rememberImage(uri, cached); return Promise.resolve(cached); }
  const pending = pendingImages.get(uri);
  if (pending) return pending;
  const operation = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6_000);
    try {
      const response = await fetch(uri, { credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error('Artwork unavailable.');
      const blob = await response.blob();
      if (!blob.size || blob.size > 10 * 1024 * 1024 || !/^image\//.test(blob.type)) throw new Error('Invalid artwork.');
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        const reading = setTimeout(() => { reader.abort(); reject(new Error('Image read timed out.')); }, 6_000);
        reader.onerror = () => { clearTimeout(reading); reject(new Error('Could not prepare mix artwork.')); };
        reader.onload = () => {
          clearTimeout(reading);
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Could not prepare mix artwork.'));
        };
        reader.readAsDataURL(blob);
      });
      // An HTTP200 image response can still contain invalid/unsupported bytes.
      // Decode before giving SVG a source so it never draws a broken-image icon.
      await new Promise<void>((resolve, reject) => {
        const decoding = setTimeout(() => reject(new Error('Image decode timed out.')), 6_000);
        Image.getSize(data, (width, height) => { clearTimeout(decoding); if (width > 0 && height > 0) resolve(); else reject(new Error('Invalid artwork dimensions.')); }, () => { clearTimeout(decoding); reject(new Error('Could not decode artwork.')); });
      });
      rememberImage(uri, data);
      markArtworkLoaded(uri);
      return data;
    } catch (error) { markArtworkFailed(uri); throw error; }
    finally { clearTimeout(timer); }
  })();
  pendingImages.set(uri, operation);
  void operation.finally(() => { if (pendingImages.get(uri) === operation) pendingImages.delete(uri); }).catch(() => undefined);
  return operation;
}

/** Home, Library, and detail share decoded bytes and in-flight requests. */
export async function resolvePersonalMixArtwork(songs: CrimsonSong[], count = 2, small = false) {
  const selected = [...new Map(songs.filter((song) => /^https:\/\//.test(song.image || song.imageSmall)).map((song) => [song.image || song.imageSmall, song])).values()].slice(0, count);
  if (!selected.length) throw new Error('This mix does not have song artwork yet.');
  return Promise.all(selected.map(async (song) => {
    const preferred = small ? [song.imageSmall, song.artwork?.medium, song.image] : [song.image, song.artwork?.medium, song.imageSmall];
    const urls = [...new Set([...preferred, ...imageArtworkCandidates(preferred.find(Boolean) || '', song.artwork)])].filter((uri) => /^https:\/\//.test(uri)).slice(0, 6);
    for (const uri of urls) {
      if (isFailedArtwork(uri) && !imageCache.has(uri)) continue;
      try { return await decodedImage(uri); }
      catch { /* Try the same song's other size or an Audius mirror. */ }
    }
    throw new Error('Could not load the mix artwork. Check your connection and try saving again.');
  }));
}
