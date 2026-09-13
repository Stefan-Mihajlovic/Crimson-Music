/* global jest, beforeEach, afterEach, test, expect */
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

import ArtistSpotlight from '../src/components/artist-spotlight';

let mockSettings;
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => mockSettings }));
jest.mock('../src/components/artwork-image', () => ({ __esModule: true, default: 'ArtworkImage' }));
jest.mock('../src/components/now-playing-artwork', () => ({ CollectionPlayingOverlay: 'CollectionPlayingOverlay' }));
jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'SymbolView' }));

const artist = { id: 'artist-1', name: 'A featured artist', image: 'https://example.com/artist.jpg', followers: '34.1K', description: 'Songs from the artist’s own biography.', artwork: {} };
const onPlay = jest.fn();
const onOpen = jest.fn();
const onMenu = jest.fn();
const defaults = { artist, songs: [{ id: 'song-1', streamable: true }], onPlay, onOpen, onMenu };
let root;
const originalPlatform = Platform.OS;
const button = (label) => root.root.findAll((node) => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label)[0];
const render = async (props = {}) => { await act(async () => { root = create(<ArtistSpotlight {...defaults} {...props} />); }); };

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockSettings = { isDark: true, reduceMotion: false };
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = undefined;
  Platform.OS = originalPlatform;
});

test('play, profile, and menu are independent actions rather than nested press targets', async () => {
  await render();
  await act(async () => button(`Play ${artist.name}`).props.onPress());
  expect(onPlay).toHaveBeenCalledTimes(1);
  expect(onOpen).not.toHaveBeenCalled();
  await act(async () => button(`View ${artist.name}'s profile`).props.onPress());
  expect(onOpen).toHaveBeenCalledTimes(1);
  await act(async () => button(`More options for ${artist.name}`).props.onPress());
  expect(onMenu).toHaveBeenCalledTimes(1);
  for (const control of root.root.findAll((node) => node.props.accessibilityRole === 'button')) {
    let parent = control.parent;
    while (parent) {
      if (parent.props.accessibilityRole === 'button') {
        expect(parent.props.accessibilityLabel).toBe(control.props.accessibilityLabel);
      }
      parent = parent.parent;
    }
  }
});

test.each([
  { songs: [] },
  { songs: [{ id: 'private', streamable: false }] },
  { loading: true },
])('shows a working profile action without a dead Play action when the queue is unavailable: %j', async (props) => {
  await render(props);
  expect(button(`Play ${artist.name}`)).toBeUndefined();
  await act(async () => button(`View ${artist.name}'s profile`).props.onPress());
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test('uses a local image after native image failure and loads the next artist independently', async () => {
  Platform.OS = 'ios';
  await render();
  const image = () => root.root.findByType('ArtworkImage');
  expect(image().props.source).toEqual({ uri: artist.image });
  await act(async () => image().props.onError());
  expect(image().props.source).toEqual(image().props.fallbackSource);
  await act(async () => root.update(<ArtistSpotlight {...defaults} artist={{ ...artist, id: 'next', image: 'https://example.com/next.jpg' }} />));
  expect(image().props.source).toEqual({ uri: 'https://example.com/next.jpg' });
});

test('preserves web mirror failover and respects reduced motion in artwork and controls', async () => {
  Platform.OS = 'web';
  mockSettings.reduceMotion = true;
  await render();
  const image = root.root.findByType('ArtworkImage');
  await act(async () => image.props.onError());
  expect(root.root.findByType('ArtworkImage').props.source).toEqual({ uri: artist.image });
  expect(image.props.transition).toBe(0);
  const pressedStyle = StyleSheet.flatten(button(`Play ${artist.name}`).props.style({ pressed: true }));
  expect(pressedStyle.transform).toBeUndefined();
  expect(root.root.findByType('CollectionPlayingOverlay').props.sourceName).toBe(artist.name);
});

test('does not invent copy when the artist has no biography or follower count', async () => {
  await render({ artist: { ...artist, description: '  \n ', followers: '' }, onMenu: undefined });
  const tree = JSON.stringify(root.toJSON());
  expect(tree).not.toContain('followers');
  expect(tree).not.toContain('biography');
  expect(button(`More options for ${artist.name}`)).toBeUndefined();
});
