import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ArtworkImage from '../../src/components/artwork-image';
import { artworkCandidates, clearFailedArtworkCache, FAILED_ARTWORK_TTL, isFailedArtwork, markArtworkFailed } from '../../src/services/artwork-fallback';

let mockImageProps;
jest.mock('expo-image', () => ({ Image: function MockImage(props) {
  mockImageProps = props;
  return <img alt="Artwork" src={props.source?.uri || ''} onError={() => props.onError?.({ error: 'Image unavailable' })} />;
} }));

const primary = 'https://primary.example/content/cid/150x150.jpg';
const mirror = 'https://mirror.example/content/cid/150x150.jpg';
const artwork = { small: primary, mirrors: ['https://mirror.example'] };
const fallbackSource = { uri: '/fallback.webp' };
let root;
let container;
const uri = () => container.querySelector('img').getAttribute('src');
const fail = () => act(() => container.querySelector('img').dispatchEvent(new Event('error')));
const render = (props = {}) => act(() => root.render(<ArtworkImage source={{ uri: primary }} artwork={artwork} fallbackSource={fallbackSource} {...props} />));

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  clearFailedArtworkCache();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.restoreAllMocks(); });

test('a failed source tries the supplied Audius mirror and then a local placeholder without forwarding headers', () => {
  render({ source: { uri: primary, headers: { Authorization: 'must-not-be-forwarded' } } });
  expect(uri()).toBe(primary);
  expect(mockImageProps.source.headers).toBeUndefined();
  fail();
  expect(uri()).toBe(mirror);
  expect(mockImageProps.source.headers).toBeUndefined();
  fail();
  expect(uri()).toBe('/fallback.webp');
  fail();
  expect(uri()).toBe('/fallback.webp');
});

test('failed URLs are skipped on remount until their TTL expires', () => {
  let now = 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  render(); fail();
  expect(uri()).toBe(mirror);
  act(() => root.render(null));
  render();
  expect(uri()).toBe(mirror);
  act(() => root.render(null));
  now += FAILED_ARTWORK_TTL + 1;
  render();
  expect(uri()).toBe(primary);
});

test('switching items resets fallback state and ignores late failures from the old image', () => {
  render({ recyclingKey: 'first' });
  const oldFailure = mockImageProps.onError;
  fail();
  const second = 'https://new.example/content/second/480x480.jpg';
  render({ source: { uri: second }, artwork: undefined, recyclingKey: 'second' });
  expect(uri()).toBe(second);
  act(() => oldFailure({ error: 'Late old request' }));
  expect(uri()).toBe(second);
});

test('mirror candidates use only explicit HTTPS node origins and never copy source query parameters', () => {
  expect(artworkCandidates(`${primary}?token=private`, {
    mirrors: ['https://mirror.example', 'http://insecure.example', 'https://user:password@private.example'],
  })).toEqual([`${primary}?token=private`, mirror]);
  expect(artworkCandidates('https://other.example/avatar.jpg', { mirrors: ['https://mirror.example'] })).toEqual(['https://other.example/avatar.jpg']);
});

test('the failed URL cache stays bounded', () => {
  for (let index = 0; index < 520; index += 1) markArtworkFailed(`https://node.example/${index}.jpg`, 1000);
  expect(isFailedArtwork('https://node.example/0.jpg', 1001)).toBe(false);
  expect(isFailedArtwork('https://node.example/519.jpg', 1001)).toBe(true);
});
