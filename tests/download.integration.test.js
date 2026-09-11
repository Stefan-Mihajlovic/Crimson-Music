import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { DownloadProvider, useDownloads } from '../src/providers/download-provider';
import { downloadTrackFile, deleteDownloadedFile, saveDownloadManifest } from '../src/services/downloads';
import { getAudiusTrack } from '../src/services/audius';
import NetInfo from '@react-native-community/netinfo';
import { setDataSaverEnabled } from '../src/services/data-usage';
import { loadAutomaticDownloadTargets } from '../src/services/music';

let mockUser;
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../src/services/telemetry', () => ({ reportError: jest.fn() }));
jest.mock('../src/services/audius', () => ({ getAudiusTrack: jest.fn() }));
jest.mock('../src/services/music', () => ({ loadAutomaticDownloadTargets: jest.fn() }));
jest.mock('../src/services/navigation-events', () => ({ subscribeToLibraryRefresh: () => () => {} }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true, NetInfoStateType: { wifi: 'wifi' },
  default: { fetch: jest.fn(), addEventListener: jest.fn() },
}));
jest.mock('../src/services/downloads', () => ({
  DOWNLOAD_DEFAULT_BYTES: 100_000_000, DOWNLOAD_MAX_BYTES: 400_000_000, DOWNLOAD_MAX_TRACK_BYTES: 50_000_000, DOWNLOAD_MIN_BYTES: 10_000_000,
  estimatedTrackDownloadBytes: () => 1_000,
  loadDownloadPreferences: jest.fn(async () => ({ enabled: true, automatic: false, wifiOnly: false, maxBytes: 100_000_000 })),
  loadDownloadManifest: jest.fn(async () => ({})),
  loadDownloadCollectionTargets: jest.fn(async () => ({})),
  saveDownloadManifest: jest.fn(async () => {}),
  saveDownloadPreferences: jest.fn(async () => {}),
  saveDownloadCollectionTargets: jest.fn(async () => {}),
  clearDownloadedFiles: jest.fn(async () => {}),
  deleteDownloadedFile: jest.fn(),
  downloadTrackFile: jest.fn(),
}));

let downloads;
let root;
let networkListeners;
function Probe() { downloads = useDownloads(); return null; }
const tree = () => React.createElement(DownloadProvider, null, React.createElement(Probe));
const song = (id) => ({ id, source: 'audius', streamable: true, duration: 180, title: id });
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(async () => {
  setDataSaverEnabled(false);
  networkListeners = new Set();
  NetInfo.fetch.mockResolvedValue({ type: 'wifi', isConnected: true });
  NetInfo.addEventListener.mockImplementation((listener) => {
    networkListeners.add(listener);
    return () => networkListeners.delete(listener);
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockUser = { uid: 'download-owner' };
  getAudiusTrack.mockImplementation(async (id) => song(id));
  downloadTrackFile.mockImplementation(async (_uid, item) => ({ bytes: 1_000, uri: `file:///fixture/${item.id}.mp3` }));
  await act(async () => { root = create(tree()); });
});
afterEach(async () => { await act(async () => root.unmount()); setDataSaverEnabled(false); });

test('concurrent requests for the same song share the saved file', async () => {
  let result;
  await act(async () => { result = await Promise.all([downloads.downloadSong(song('one')), downloads.downloadSong(song('one'))]); });
  expect(result).toEqual([true, true]);
  expect(downloadTrackFile).toHaveBeenCalledTimes(1);
  expect(downloads.downloadedCount).toBe(1);
  expect(downloads.getPlaybackUri('one')).toBe('file:///fixture/one.mp3');
});

test('Data Saver blocks cellular downloads before any track or audio request', async () => {
  NetInfo.fetch.mockResolvedValue({ type: 'cellular', isConnected: true });
  setDataSaverEnabled(true);
  await act(async () => {
    await expect(downloads.downloadSong(song('cellular'))).rejects.toMatchObject({ code: 'wifi-required' });
  });
  expect(getAudiusTrack).not.toHaveBeenCalled();
  expect(downloadTrackFile).not.toHaveBeenCalled();
});

test('Data Saver avoids fetching the automatic download library on cellular', async () => {
  NetInfo.fetch.mockResolvedValue({ type: 'cellular', isConnected: true });
  setDataSaverEnabled(true);
  await act(async () => { downloads.setAutomatic(true); });
  await act(async () => { await downloads.syncAutomaticDownloads(); });
  expect(loadAutomaticDownloadTargets).not.toHaveBeenCalled();
  expect(downloadTrackFile).not.toHaveBeenCalled();
});

test('leaving Wi-Fi with Data Saver aborts a file and does not mark it downloaded', async () => {
  const file = deferred();
  downloadTrackFile.mockReturnValueOnce(file.promise);
  setDataSaverEnabled(true);
  let pending;
  await act(async () => { pending = downloads.downloadSong(song('wifi')).catch((error) => error); });
  const signal = downloadTrackFile.mock.calls[0][3];
  await act(async () => {
    const cellular = { type: 'cellular', isConnected: true };
    NetInfo.fetch.mockResolvedValue(cellular);
    networkListeners.forEach((listener) => listener(cellular));
  });
  expect(signal.aborted).toBe(true);
  await act(async () => { file.resolve({ bytes: 1_000, uri: 'file:///fixture/wifi.mp3' }); await pending; });
  expect(await pending).toMatchObject({ code: 'wifi-required' });
  expect(downloads.downloadedCount).toBe(0);
  expect(deleteDownloadedFile).toHaveBeenCalledWith('file:///fixture/wifi.mp3');
  expect(saveDownloadManifest).not.toHaveBeenCalled();
  expect(downloads.statusFor('wifi').state).toBe('waiting-for-wifi');
});

test('sign out aborts an in-flight file and never attaches it to a new account', async () => {
  const file = deferred();
  downloadTrackFile.mockReturnValueOnce(file.promise);
  let result;
  await act(async () => { result = downloads.downloadSong(song('one')).catch((error) => error.message); });
  const signal = downloadTrackFile.mock.calls[0][3];
  mockUser = { uid: 'new-owner' };
  await act(async () => root.update(tree()));
  expect(signal.aborted).toBe(true);
  await act(async () => { file.resolve({ bytes: 1_000, uri: 'file:///fixture/old.mp3' }); await result; });
  expect(deleteDownloadedFile).toHaveBeenCalledWith('file:///fixture/old.mp3');
  expect(downloads.downloadedCount).toBe(0);
  expect(saveDownloadManifest).not.toHaveBeenCalled();
});

test('late metadata cannot start a download after account change', async () => {
  const metadata = deferred();
  getAudiusTrack.mockReturnValueOnce(metadata.promise);
  let pending;
  await act(async () => { pending = downloads.downloadSong(song('one')).catch((error) => error.message); });
  mockUser = null;
  await act(async () => root.update(tree()));
  await act(async () => { metadata.resolve(song('one')); await pending; });
  expect(downloadTrackFile).not.toHaveBeenCalled();
  expect(downloads.downloadedCount).toBe(0);
});

test('batch results deduplicate tracks and report failed saves accurately', async () => {
  getAudiusTrack.mockImplementation(async (id) => ({ ...song(id), streamable: id !== 'unavailable' }));
  let result;
  await act(async () => { result = await downloads.downloadSongs([song('one'), song('one'), song('unavailable')], 'manual', 'playlist:test'); });
  expect(result).toEqual({ downloaded: 1, skipped: 0, failed: 1 });
  expect(downloads.isCollectionDownloaded('playlist:test')).toBe(false);
  expect(downloads.isTrackUnavailableForCollection('playlist:test', 'unavailable')).toBe(true);
});
