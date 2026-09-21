import { beforeEach, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { importLocalMusic, scanLocalMusic, readLocalMusic, refreshImportedMusic, setLocalFavorite } from '../src/services/local-music';
import { activateAccount, disposeDeletedAccount } from '../src/services/account-lifecycle';
import { localAudioSong, mergeLocalMusic } from '../src/services/local-music-model';
import { scanDeviceAudio, pickLocalAudio, listImportedAudio, resolveLocalAudioUri } from '../src/services/local-music-platform';
import { getUserCollectionState, loadFavoriteSongs, resolveTrackPlaybackUrl, setSongInOwnedPlaylist, toggleUserCollectionItem, recordListeningEvent, loadListeningHistoryPage } from '../src/services/music';
import { savePlaybackSession, restorePlaybackSession } from '../src/services/playback-session';
import { audiusRequest } from '../src/services/audius-session';
import { getAudiusTrack, resolveAudiusStreamUrl } from '../src/services/audius';
import { withLocalPlaylistTracks, withLocalPlaylistDetail, savePlaylistOrder } from '../src/services/playlist-local-tracks';
import { playlistPickerArtwork } from '../src/services/playlist-artwork';
import { buildLibraryCollection, filterLibraryCollection } from '../src/services/library-collection';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/services/local-music-platform', () => ({ scanDeviceAudio: jest.fn(), pickLocalAudio: jest.fn(), listImportedAudio: jest.fn(), removeImportedAudio: jest.fn(), resolveLocalAudioUri: jest.fn() }));
jest.mock('../src/services/audius-session', () => ({ audiusRequest: jest.fn(), getCurrentAudiusUserId: () => 'listener' }));
jest.mock('../src/services/audius', () => ({ getAudiusTrack: jest.fn(), resolveAudiusStreamUrl: jest.fn() }));
jest.mock('../src/services/telemetry', () => ({ reportError: jest.fn() }));
const imported = { id: 'import:first.mp3', kind: 'import', filename: 'First.mp3', uri: 'file:///music/First.mp3', artist: 'Artist', duration: 180 };
const device = { id: 'android:45', kind: 'device', filename: 'Recording.wav', uri: 'content://media/external/audio/media/45', duration: 25 };

beforeEach(async () => {
  activateAccount('listener');
  await AsyncStorage.clear(); jest.clearAllMocks();
  audiusRequest.mockResolvedValue({ data: [] });
  pickLocalAudio.mockResolvedValue({ files: [imported], skipped: 0 });
  scanDeviceAudio.mockResolvedValue({ files: [device], skipped: 0 });
  listImportedAudio.mockResolvedValue([imported]);
  resolveLocalAudioUri.mockImplementation(async (song) => song.url);
});

test('imports persist playable metadata and device rescans replace stale device audio without deleting imported copies', async () => {
  await importLocalMusic(); await scanLocalMusic();
  expect(await readLocalMusic()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'local:import:first.mp3', source: 'local', url: imported.uri }), expect.objectContaining({ id: 'local:android:45', local: { kind: 'device', filename: 'Recording.wav' } })]));
  scanDeviceAudio.mockResolvedValueOnce({ files: [], skipped: 0 });
  await scanLocalMusic();
  expect((await readLocalMusic()).map((song) => song.id)).toEqual(['local:import:first.mp3']);
  await importLocalMusic();
  expect(await readLocalMusic()).toHaveLength(1);
});

test('denied scans preserve the existing collection, and rescanning imports removes deleted copies', async () => {
  await importLocalMusic(); await scanLocalMusic();
  scanDeviceAudio.mockRejectedValueOnce(new Error('Permission denied'));
  await expect(scanLocalMusic()).rejects.toThrow('Permission denied');
  expect(await readLocalMusic()).toHaveLength(2);
  listImportedAudio.mockResolvedValueOnce([]);
  await refreshImportedMusic();
  expect((await readLocalMusic()).map((song) => song.id)).toEqual(['local:android:45']);
});

test('source routing plays imported URLs without calling Audius, while remote tracks keep Audius resolution', async () => {
  await importLocalMusic();
  const song = localAudioSong(imported);
  await expect(resolveTrackPlaybackUrl(song)).resolves.toBe(imported.uri);
  expect(resolveAudiusStreamUrl).not.toHaveBeenCalled();
  resolveAudiusStreamUrl.mockResolvedValueOnce('https://stream.example/audio');
  await expect(resolveTrackPlaybackUrl({ id: 'remote', source: 'audius', url: '' })).resolves.toBe('https://stream.example/audio');
  expect(resolveAudiusStreamUrl).toHaveBeenCalledWith('remote');
});

test('local favorites persist and appear offline without a remote favorite or playlist write', async () => {
  await importLocalMusic(); const id = 'local:import:first.mp3';
  await expect(toggleUserCollectionItem('listener', 'LikedSongs', id)).resolves.toBe(true);
  await expect(getUserCollectionState('listener', 'LikedSongs', id)).resolves.toBe(true);
  expect((await loadFavoriteSongs('listener', { offlineOnly: true })).map((song) => song.id)).toEqual([id]);
  expect(audiusRequest).not.toHaveBeenCalled();
  await expect(toggleUserCollectionItem('listener', 'LikedSongs', id)).resolves.toBe(false);
});

test('disconnect clears local favorites and rejects late writes without removing device audio', async () => {
  await importLocalMusic();
  await setLocalFavorite('listener', 'local:import:first.mp3', true);
  await disposeDeletedAccount('listener');
  await expect(setLocalFavorite('listener', 'local:import:first.mp3', true)).rejects.toThrow('disconnected');
  expect(await AsyncStorage.getItem('crimson.local-favorites.v1:listener')).toBeNull();
  expect(await readLocalMusic()).toHaveLength(1);
});

test('resume and listening history preserve local source, stable URI and metadata', async () => {
  const song = localAudioSong(imported);
  await savePlaybackSession('listener', { queue: [song], index: 0, position: 42, shuffled: false, repeat: 'none', source: 'Local Music', sourceId: 'local-music' });
  expect((await restorePlaybackSession('listener')).queue[0]).toMatchObject({ source: 'local', url: imported.uri, local: { kind: 'import', filename: 'First.mp3' } });
  await recordListeningEvent('listener', 'play', song.id, song);
  expect((await loadListeningHistoryPage('listener')).items[0].song).toMatchObject({ source: 'local', url: imported.uri });
});

test('picker artwork retains custom covers and fills missing covers from up to four unique songs', async () => {
  const playlist = { id: 'playlist', title: 'Mix', source: 'audius', songs: ['one', 'one', 'two', 'three', 'four', 'five'] };
  const custom = { ...playlist, image: 'https://cover/custom' };
  await expect(playlistPickerArtwork(custom)).resolves.toBe(custom);
  expect(getAudiusTrack).not.toHaveBeenCalled();
  getAudiusTrack.mockImplementation(async (id) => ({ image: `https://cover/${id}`, imageSmall: `https://small/${id}` }));
  expect(await playlistPickerArtwork(playlist)).toMatchObject({ coverImages: ['https://cover/one', 'https://cover/two', 'https://cover/three', 'https://cover/four'] });
  expect(getAudiusTrack).toHaveBeenCalledTimes(4);
});

test('Local Music is available by default and follows the library filters', () => {
  const items = buildLibraryCollection({ playlists: [], likedPlaylists: [], followedArtists: [] }, []);
  expect(items.map((item) => item.kind)).toEqual(['favorites', 'local-music']);
  expect(filterLibraryCollection(items, 'local', { filter: 'playlists' })).toHaveLength(1);
  expect(filterLibraryCollection(items, 'local', { filter: 'artists' })).toHaveLength(0);
  expect(mergeLocalMusic([localAudioSong(imported)], [localAudioSong(imported)])).toHaveLength(1);
});


test('local playlist membership survives reload and removal, without sending local IDs to Audius', async () => {
  await importLocalMusic();
  const localId = 'local:import:first.mp3';
  const playlist = { id: 'p-local', owned: true, source: 'audius', songs: ['remote'], title: 'Mixed' };
  await AsyncStorage.setItem('crimson.offline.data.v2:library:listener', JSON.stringify({ playlists: [playlist], likedPlaylists: [], followedArtists: [] }));
  audiusRequest.mockRejectedValue(new Error('Offline'));
  await expect(setSongInOwnedPlaylist('listener', playlist.id, localId, true)).resolves.toBe(true);
  expect((await withLocalPlaylistTracks(playlist, 'listener')).songs).toEqual(['remote', localId]);
  const detail = await withLocalPlaylistDetail({ playlist, songs: [{ id: 'remote' }] }, 'listener');
  expect(detail.songs.map((song) => song.id)).toEqual(['remote', localId]);
  await savePlaylistOrder('listener', playlist.id, [localId, 'remote']);
  expect((await withLocalPlaylistTracks(playlist, 'listener')).songs).toEqual([localId, 'remote']);
  await expect(setSongInOwnedPlaylist('listener', playlist.id, localId, false)).resolves.toBe(false);
  expect((await withLocalPlaylistTracks(detail.playlist, 'listener')).songs).toEqual(['remote']);
  expect(audiusRequest.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
  expect((await withLocalPlaylistTracks(playlist, 'another-user')).songs).toEqual(['remote']);
});


test('missing local files do not break playlist loading and disconnect removes membership', async () => {
  await importLocalMusic();
  const playlist = { id: 'missing-local', owned: true, songs: ['remote'] };
  await savePlaylistOrder('listener', playlist.id, ['local:import:deleted.mp3', 'remote']);
  expect((await withLocalPlaylistTracks(playlist, 'listener')).songs).toEqual(['remote']);
  await disposeDeletedAccount('listener');
  expect(await AsyncStorage.getItem('crimson.playlist-local-tracks.v1:listener:missing-local')).toBeNull();
  await expect(savePlaylistOrder('listener', playlist.id, ['remote'])).rejects.toThrow('disconnected');
});
