import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import ArtworkImage from '../src/components/artwork-image';
import { useDisplayedArtwork } from '../src/hooks/use-displayed-artwork';
import { artworkStatusSnapshot, clearFailedArtworkCache, imageArtworkCandidates, markArtworkFailed, markArtworkLoaded } from '../src/services/artwork-fallback';
import { fallbackArtworkPalette } from '../src/services/artwork-palette-colors';
import LocalMusicArtwork from '../src/components/local-music-artwork';
import FavoritesArtwork from '../src/components/favorites-artwork';

jest.mock('expo-image', () => ({ Image: 'ArtworkImage', getCachePathAsync: jest.fn() }));
jest.mock('expo-modules-core', () => { const actual = jest.requireActual('expo-modules-core'); return { ...actual, requireNativeModule: (name, ...args) => name === 'ExpoAudio' ? {} : actual.requireNativeModule(name, ...args) }; });
const primary = 'https://cover.example/content/track/1000x1000.jpg';
const small = 'https://cover.example/content/track/150x150.jpg';
const mirror = 'https://mirror.example/content/track/1000x1000.jpg';
const fallbackSource = { uri: '/bundled-default.webp' };
const song = { id: 'one', image: primary, imageSmall: small, artwork: { mirrors: ['https://mirror.example'] } };
let root;
function Probe({ item, dataSaver = false }) { const displayed = useDisplayedArtwork(item, dataSaver); return <Displayed source={displayed.source} revision={displayed.revision} />; }
function Displayed() { return null; }
const renderedImage = () => root.root.findByType('ArtworkImage');
const displayed = () => root.root.findByType(Displayed).props;
const mount = async (item = song, props = {}) => act(async () => { root = create(<><Probe item={item} /><ArtworkImage source={item.image ? { uri: item.image } : 1} artwork={item.artwork} fallbackSource={fallbackSource} {...props} /></>); });
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; clearFailedArtworkCache(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = undefined; jest.restoreAllMocks(); });

test('all platforms share the actual bundled purple artwork palette without requiring image downloads', () => {
  expect(fallbackArtworkPalette).toEqual(['#30084B', '#92106A', '#570C8F']);
  expect(require('../src/services/artwork-palette').fallbackArtworkPalette).toBe(fallbackArtworkPalette);
  expect(require('../src/services/artwork-palette.android').fallbackArtworkPalette).toBe(fallbackArtworkPalette);
  expect(require('../src/services/artwork-palette.web').fallbackArtworkPalette).toBe(fallbackArtworkPalette);
});

test('missing cover selects the bundled image and reports a fallback palette source', async () => {
  await mount({ id: 'local:no-cover', image: '', imageSmall: '' });
  expect(renderedImage().props.source).toBe(1);
  expect(displayed().source).toBeNull();
});

test('native failed artwork and its observed palette source advance together through mirrors to the bundled fallback', async () => {
  await mount();
  expect(displayed().source).toBe(primary);
  await act(async () => renderedImage().props.onError({ error: 'unavailable' }));
  expect(renderedImage().props.source).toEqual({ uri: mirror });
  expect(displayed().source).toBe(mirror);
  await act(async () => renderedImage().props.onError({ error: 'unavailable' }));
  expect(renderedImage().props.source).toEqual(fallbackSource);
  expect(displayed().source).toBeNull();
  await act(async () => renderedImage().props.onError({ error: 'bundled file error' }));
  expect(renderedImage().props.source).toEqual(fallbackSource);
});

test('local file artwork falls back on failure and image loads refresh its cache-only palette observation', async () => {
  const local = { id: 'local:one', image: 'file:///device/cover.jpg', imageSmall: '' };
  await mount(local);
  const before = displayed().revision;
  await act(async () => renderedImage().props.onLoad({ source: { url: local.image } }));
  expect(displayed().revision).not.toBe(before);
  expect(displayed().source).toBe(local.image);
  await act(async () => renderedImage().props.onError({ error: 'file missing' }));
  expect(renderedImage().props.source).toEqual(fallbackSource);
  expect(displayed().source).toBeNull();
});

test('palette observes the displayed large cover, respects Data Saver, and ignores unrelated image loads', async () => {
  await act(async () => { root = create(<Probe item={song} />); });
  expect(displayed().source).toBe(primary);
  const before = displayed().revision;
  await act(async () => markArtworkLoaded('https://unrelated.example/image.jpg'));
  expect(displayed().revision).toBe(before);
  await act(async () => root.update(<Probe item={song} dataSaver />));
  expect(displayed().source).toBe(small);
});

test('switching images ignores delayed old failures and loads', async () => {
  await mount();
  const oldImage = renderedImage().props;
  const next = 'https://new.example/image.jpg';
  await act(async () => root.update(<><Probe item={{ id: 'new', image: next }} /><ArtworkImage recyclingKey="new" source={{ uri: next }} /></>));
  await act(async () => { oldImage.onError({ error: 'late' }); oldImage.onLoad({}); });
  expect(renderedImage().props.source).toEqual({ uri: next });
  expect(displayed().source).toBe(next);
});

test('a successful later load clears a temporary failure and updates the observed candidate', () => {
  const candidates = imageArtworkCandidates(primary);
  markArtworkFailed(primary);
  const failed = artworkStatusSnapshot(candidates);
  markArtworkLoaded(primary);
  expect(artworkStatusSnapshot(candidates)).not.toBe(failed);
});

test.each(['thumbnail', 'hero'])('Local Music %s is a bundled image filling its cover container, with no fixed-size glyph', async (variant) => {
  await act(async () => { root = create(<LocalMusicArtwork variant={variant} size={20} style={{ width: 300, height: 300 }} />); });
  expect(renderedImage().props.source).toEqual(require('../assets/images/local-music/cover-matte.png'));
  expect(renderedImage().props.contentFit).toBe(variant === 'hero' ? 'contain' : 'cover');
  const style = renderedImage().props.style;
  expect(style.width).not.toBe(20);
  expect(style.height).not.toBe(20);
});


test('late events from a failed candidate cannot replace the mirror currently shown', async () => {
  await mount();
  const old = renderedImage().props;
  await act(async () => old.onError({ error: 'primary failed' }));
  expect(displayed().source).toBe(mirror);
  await act(async () => { old.onLoad({}); old.onError({ error: 'late old error' }); });
  expect(renderedImage().props.source).toEqual({ uri: mirror });
  expect(displayed().source).toBe(mirror);
});


test('a mounted fallback retains its palette after failure TTL expires until the image actually retries', async () => {
  let now = 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  await mount();
  await act(async () => renderedImage().props.onError({ error: 'primary failed' }));
  await act(async () => renderedImage().props.onError({ error: 'mirror failed' }));
  expect(displayed().source).toBeNull();
  now += 6 * 60 * 1000;
  await act(async () => root.update(<><Probe item={{ ...song }} /><ArtworkImage source={{ uri: primary }} artwork={song.artwork} fallbackSource={fallbackSource} /></>));
  expect(renderedImage().props.source).toEqual(fallbackSource);
  expect(displayed().source).toBeNull();
});


test.each(['thumbnail', 'hero'])('Favorites %s uses the matching static matte image and keeps wide hero artwork in bounds', async (variant) => {
  await act(async () => { root = create(<FavoritesArtwork variant={variant} contentFit="cover" style={{ width: 900, height: 390 }} />); });
  expect(renderedImage().props.source).toEqual(require('../assets/images/favorites/heart-matte.png'));
  expect(renderedImage().props.autoplay).toBe(false);
  expect(renderedImage().props.contentFit).toBe(variant === 'hero' ? 'contain' : 'cover');
});
