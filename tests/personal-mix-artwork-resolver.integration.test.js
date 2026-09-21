import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { Blob } from 'node:buffer';
import { Image } from 'react-native';
import { clearFailedArtworkCache } from '../src/services/artwork-fallback';
import { resolvePersonalMixArtwork } from '../src/services/personal-mix-artwork';

const originalFetch = globalThis.fetch;
const originalReader = globalThis.FileReader;
let decode;
const track = (id) => ({ image: `https://artwork.example/${id}/1000.jpg`, imageSmall: `https://artwork.example/${id}/150.jpg`, artwork: { medium: `https://artwork.example/${id}/480.jpg`, mirrors: [] } });
const response = (data) => ({ ok: true, blob: async () => new Blob([data], { type: 'image/jpeg' }) });

beforeEach(() => {
  clearFailedArtworkCache();
  globalThis.fetch = jest.fn();
  globalThis.FileReader = class {
    readAsDataURL(blob) { void blob.arrayBuffer().then((bytes) => { this.result = `data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`; this.onload?.(); }); }
    abort() {}
  };
  decode = jest.spyOn(Image, 'getSize').mockImplementation((_uri, success) => success(480, 480));
});
afterEach(() => { globalThis.fetch = originalFetch; globalThis.FileReader = originalReader; decode.mockRestore(); });

test.each(['150', '480'])('a broken large image falls back to the same photo at %spx before SVG receives it', async (size) => {
  const song = track(`fallback-${size}`);
  globalThis.fetch.mockImplementation(async (uri) => uri.endsWith(`/${size}.jpg`) ? response(`same-photo-${size}`) : { ok: false });
  const photos = await resolvePersonalMixArtwork([song], 1, false);
  expect(photos).toEqual([`data:image/jpeg;base64,${Buffer.from(`same-photo-${size}`).toString('base64')}`]);
  expect(decode).toHaveBeenCalledWith(photos[0], expect.any(Function), expect.any(Function));
  expect(globalThis.fetch).toHaveBeenCalledWith(song.image, expect.objectContaining({ credentials: 'omit' }));
  expect(globalThis.fetch).toHaveBeenCalledWith(`https://artwork.example/fallback-${size}/${size}.jpg`, expect.any(Object));
});

test('Library and hero share in-flight downloads and decoded bytes', async () => {
  const song = track('shared');
  globalThis.fetch.mockImplementation(async (uri) => uri === song.image ? { ok: false } : response('shared-photo'));
  const [hero, libraryPhoto] = await Promise.all([resolvePersonalMixArtwork([song], 1), resolvePersonalMixArtwork([song], 1)]);
  expect(hero).toEqual(libraryPhoto);
  expect(globalThis.fetch.mock.calls.map(([uri]) => uri)).toEqual([song.image, song.artwork.medium]);
  expect(decode).toHaveBeenCalledTimes(1);
  await resolvePersonalMixArtwork([song], 1);
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});

test('an HTTP200 response that cannot decode is rejected and the next size is tried', async () => {
  const song = track('bad-bytes');
  globalThis.fetch.mockImplementation(async (uri) => response(uri === song.image ? 'bad-image' : 'valid-image'));
  decode.mockImplementation((uri, success, failure) => uri.includes(Buffer.from('bad-image').toString('base64')) ? failure(new Error('decode')) : success(480, 480));
  await expect(resolvePersonalMixArtwork([song], 1)).resolves.toEqual([`data:image/jpeg;base64,${Buffer.from('valid-image').toString('base64')}`]);
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
});

test('small cards request only small artwork when it works', async () => {
  const song = track('data-saver');
  globalThis.fetch.mockResolvedValue(response('small-photo'));
  await resolvePersonalMixArtwork([song], 1, true);
  expect(globalThis.fetch.mock.calls.map(([uri]) => uri)).toEqual([song.imageSmall]);
});
