import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import PlayerDetailsSheet from '../src/components/player-details-sheet';

let mockPlayer;
let mockQueueProps;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 34 }) }));
jest.mock('../src/providers/player-provider', () => ({ usePlayer: () => mockPlayer, usePlayerStatus: () => ({ playing: true }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { text: '#fff', secondaryText: '#aaa', accent: '#a78aff' } }) }));
jest.mock('../src/services/music', () => ({ loadRelatedSongs: jest.fn(async () => []) }));
jest.mock('../src/components/player-details-tabs', () => 'DetailsTabs');
jest.mock('../src/components/now-playing-artwork', () => 'Artwork');
jest.mock('../src/components/download-status-icon', () => () => null);
jest.mock('../src/components/song-list-row', () => 'SongListRow');
jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'Symbol' }));
jest.mock('../src/components/reorderable-queue', () => (props) => {
  const React = require('react');
  mockQueueProps = props;
  return <>{props.ListHeaderComponent}{props.items.map((item) => <React.Fragment key={item.key}>{props.renderRow(item, null)}</React.Fragment>)}{props.ListFooterComponent}</>;
});
let root;
const button = (label) => root.root.findAll((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const song = (id) => ({ id, title: id, creator: 'Artist', image: '', imageSmall: '' });
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const duplicate = song('Repeat');
  mockPlayer = { queue: [duplicate, song('Previous'), duplicate, song('Next'), song('Later')], queueIndex: 2, currentSong: duplicate,
    source: 'Favorites', playQueueIndex: jest.fn(), togglePlay: jest.fn(), removeFromQueue: jest.fn(), moveQueueItem: jest.fn() };
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });

test('history, current song and upcoming tracks form one ordered list with only the current occurrence highlighted', async () => {
  await act(async () => { root = create(<PlayerDetailsSheet />); });
  expect(mockQueueProps.items.map((item) => item.song.title)).toEqual(['Repeat', 'Previous', 'Repeat', 'Next', 'Later']);
  expect(new Set(mockQueueProps.items.map((item) => item.key)).size).toBe(5);
  expect(mockQueueProps.currentIndex).toBe(2);
  expect(mockQueueProps.minimumMoveIndex).toBe(3);
  expect(root.root.findAllByType('Artwork').map((item) => item.props.active)).toEqual([false, false, true, false, false]);
  const labels = root.root.findAllByType(Text).map((item) => item.props.children);
  expect(labels).not.toContain('Now playing');
  expect(labels).not.toContain('Previously played');
  await act(async () => button('Play Previous by Artist').props.onPress());
  expect(mockPlayer.playQueueIndex).toHaveBeenCalledWith(1);
  await act(async () => button('Pause Repeat by Artist').props.onPress());
  expect(mockPlayer.togglePlay).toHaveBeenCalledTimes(1);
});

test('editing only offers deletion for upcoming songs and preserves queue indices', async () => {
  await act(async () => { root = create(<PlayerDetailsSheet />); });
  await act(async () => button('Edit upcoming queue').props.onPress());
  const removals = root.root.findAll((item) => item.props.accessibilityLabel?.startsWith('Remove '));
  expect([...new Set(removals.map((item) => item.props.accessibilityLabel))]).toEqual(['Remove Next from queue', 'Remove Later from queue']);
  await act(async () => button('Remove Next from queue').props.onPress());
  expect(mockPlayer.removeFromQueue).toHaveBeenCalledWith(3);
});
