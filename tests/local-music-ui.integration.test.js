import React from 'react';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { Platform } from 'react-native';
import { act, create } from 'react-test-renderer';
import LocalMusicScreen from '../src/app/local-music';
import LocalMusicActionsSheet from '../src/components/local-music-actions-sheet';
import PlaylistCollectionScreen from '../src/components/playlist-collection-screen';
import { importLocalMusic, readLocalMusic, refreshImportedMusic, scanLocalMusic } from '../src/services/local-music';
import { Alert } from '../src/services/alert';

const mockPush = jest.fn();
const mockPlaySong = jest.fn();
let mockListener;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, dismiss: jest.fn(), canGoBack: () => true }), useFocusEffect: (effect) => require('react').useEffect(effect, [effect]), Stack: { Screen: () => null } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34 }) }));
jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'Symbol' }));
jest.mock('../src/components/local-music-artwork', () => 'LocalArtwork');
jest.mock('../src/components/bouncy-pressable', () => 'CollectionAction');
jest.mock('../src/components/playlist-cover', () => 'PlaylistCover');
jest.mock('../src/components/detail-song-row', () => 'SongRow');
jest.mock('../src/components/responsive-popup', () => function Popup({ children }) { return children; });
jest.mock('../src/components/collection-tools', () => ({ __esModule: true, default: 'CollectionTools', collectionDuration: () => '6 min', collectionSongs: (songs) => songs }));
jest.mock('../src/components/collection-header-play-button', () => ({ __esModule: true, default: 'HeaderPlay', useCollectionHeaderPlaybackVisibility: () => ({ visible: false, onScroll: jest.fn() }) }));
jest.mock('../src/hooks/use-collection-playback', () => ({ useCollectionPlayback: () => ({ playing: false, loading: false, toggleCollectionPlayback: jest.fn() }) }));
jest.mock('../src/providers/player-provider', () => ({ usePlayer: () => ({ playSong: mockPlaySong }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: {} }) }));
jest.mock('../src/services/action-sheet', () => ({ actionSheetHref: (value) => ({ pathname: '/action-sheet', params: value }), getActionSheetAnchor: () => null, releaseWebNavigationFocus: jest.fn() }));
jest.mock('../src/services/alert', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('../src/services/local-music', () => ({ LOCAL_MUSIC_ID: 'local-music', readLocalMusic: jest.fn(), refreshImportedMusic: jest.fn(), importLocalMusic: jest.fn(), scanLocalMusic: jest.fn(), subscribeLocalMusic: (listener) => { mockListener = listener; return () => { mockListener = undefined; }; } }));
let root;
const song = { id: 'local:import:one', source: 'local', title: 'My audio', creator: 'My artist', image: '', imageSmall: '', local: { kind: 'import', uri: 'file:///one.mp3' } };
const button = (label) => root.root.findAll((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  readLocalMusic.mockResolvedValue([song]);
  refreshImportedMusic.mockResolvedValue([song]);
  importLocalMusic.mockResolvedValue({ added: 1, skipped: 0 });
  scanLocalMusic.mockResolvedValue({ added: 2, skipped: 0 });
});
afterEach(async () => { if (root) await act(async () => root.unmount()); root = undefined; Platform.OS = 'ios'; });

test.each(['ios', 'android', 'web'])('%s Local Music uses playlist presentation, source-aware rows, and one options action', async (platform) => {
  Platform.OS = platform;
  await act(async () => { root = create(<LocalMusicScreen />); });
  expect(root.root.findAllByType(PlaylistCollectionScreen)).toHaveLength(1);
  expect(root.root.findAllByType('CollectionTools')).toHaveLength(1);
  expect(root.root.findAllByType('LocalArtwork')).toHaveLength(1);
  expect(button('Import audio files')).toBeUndefined();
  expect(button('Scan device')).toBeUndefined();
  await act(async () => button('Local Music options').props.onPress());
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/action-sheet', params: { type: 'local-music', id: 'local-music', title: 'Local Music', subtitle: 'On this device', image: '' } });
  const row = root.root.findByType('SongRow');
  await act(async () => row.props.onPress());
  expect(mockPlaySong).toHaveBeenLastCalledWith(song, [song], 'Local Music', 'local-music');
  await act(async () => row.props.onLongPress());
  expect(mockPush.mock.calls.at(-1)[0].params.source).toBe('local');
  readLocalMusic.mockResolvedValue([song, { ...song, id: 'local:import:two' }]);
  await act(async () => mockListener());
  expect(root.root.findAllByType('SongRow')).toHaveLength(2);
});

test.each(['ios', 'android', 'web'])('%s options popup invokes real import and platform scan/folder actions', async (platform) => {
  Platform.OS = platform;
  await act(async () => { root = create(<LocalMusicActionsSheet />); });
  await act(async () => button('Import audio files').props.onPress());
  expect(importLocalMusic).toHaveBeenCalledWith(false);
  await act(async () => button(platform === 'web' ? 'Import folder' : 'Scan device').props.onPress());
  if (platform === 'web') expect(importLocalMusic).toHaveBeenLastCalledWith(true);
  else expect(scanLocalMusic).toHaveBeenCalledTimes(1);
  await act(async () => button('About Local Music').props.onPress());
  expect(Alert.alert).toHaveBeenCalledWith('Local Music', expect.any(String));
});

test('import remains in the tap gesture, prevents duplicate pickers, and surfaces access errors in the popup', async () => {
  let fail;
  importLocalMusic.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  await act(async () => { root = create(<LocalMusicActionsSheet />); });
  const importButton = button('Import audio files');
  await act(async () => { importButton.props.onPress(); importButton.props.onPress(); expect(importLocalMusic).toHaveBeenCalledTimes(1); });
  expect(button('Scan device').props.disabled).toBe(true);
  await act(async () => fail(new Error('Allow Music and audio access in Settings.')));
  expect(button('Open system Settings')).toBeDefined();
  expect(button('Import audio files').props.disabled).toBe(false);
});
