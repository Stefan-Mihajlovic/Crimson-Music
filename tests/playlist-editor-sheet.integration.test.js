import React from 'react';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { Modal, Platform } from 'react-native';
import { act, create } from 'react-test-renderer';
import PlaylistEditorScreen from '../src/app/playlist-editor';
import { usePlaylistEditor } from '../src/components/playlist-editor';
import { confirmAction } from '../src/services/confirm-action';
import { deleteOwnedPlaylist, updateOwnedPlaylist } from '../src/services/music';
import { getPopupSession } from '../src/services/popup-sessions';
import { assertNativeSheetLayout } from './helpers/assert-native-sheet-layout';

let mockUid = 'owner';
let mockParams = {};
let mockGuard;
const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() };
const mockNavigation = { dispatch: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useNavigation: () => mockNavigation, useLocalSearchParams: () => mockParams, Redirect: 'Redirect' }));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: (enabled, handler) => { mockGuard = { enabled, handler }; } }));
jest.mock('../src/providers/auth-provider', () => ({ useAuth: () => ({ user: { uid: mockUid } }) }));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: { text: '#FFF', secondaryText: '#AAA', accent: '#965CFF', background: '#111', controlSurface: '#222', border: '#333' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
jest.mock('../src/components/app-symbol', () => ({ SymbolView: 'Symbol' }));
jest.mock('../src/components/responsive-popup', () => 'ResponsivePopup');
jest.mock('../src/services/confirm-action', () => ({ confirmAction: jest.fn() }));
jest.mock('../src/services/music', () => ({ deleteOwnedPlaylist: jest.fn(), updateOwnedPlaylist: jest.fn() }));

const playlist = { id: 'playlist', title: 'My playlist', description: '', visibility: 'public', songs: ['one', 'two'], owned: true };
const songs = [{ id: 'one', title: 'First', creator: 'Artist' }, { id: 'two', title: 'Second', creator: 'Artist' }];
const onSaved = jest.fn();
const onDeleted = jest.fn();
let owner;
let sheet;
function Launcher() {
  const open = usePlaylistEditor(mockUid);
  return <OpenEditor onPress={() => open({ playlist, songs, onSaved, onDeleted })} />;
}
function OpenEditor() { return null; }
const byLabel = (label) => sheet.root.findByProps({ accessibilityLabel: label });
const click = async (button) => act(async () => button.props.onPress());
const openSheet = async () => {
  await act(async () => { owner = create(<Launcher />); });
  await click(owner.root.findByType(OpenEditor));
  const href = mockRouter.push.mock.calls.at(-1)[0];
  expect(href.pathname).toBe('/playlist-editor');
  expect(Object.keys(href.params)).toEqual(['session']);
  mockParams = href.params;
  await act(async () => { sheet = create(<PlaylistEditorScreen />); });
};
const swipe = async () => {
  const action = { type: 'GO_BACK', source: 'playlist-editor' };
  await act(async () => mockGuard.handler({ data: { action } }));
  return action;
};
const dismissSheet = async () => { await act(async () => sheet.unmount()); sheet = undefined; };

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockUid = 'owner'; mockParams = {}; mockGuard = undefined;
  confirmAction.mockResolvedValue(false);
  updateOwnedPlaylist.mockResolvedValue({ ...playlist, title: 'Changed' });
  deleteOwnedPlaylist.mockResolvedValue(undefined);
});
afterEach(async () => {
  if (owner) await act(async () => owner.unmount());
  if (sheet) await dismissSheet();
  owner = undefined; Platform.OS = 'ios';
});

test.each(['ios', 'android', 'web'])('%s opens one routed popup and clean swipe disposal removes the session', async (platform) => {
  Platform.OS = platform;
  await openSheet();
  expect(sheet.root.findAllByType(Modal)).toHaveLength(0);
  expect(sheet.root.findByType('ResponsivePopup').props.label).toBe('Edit playlist');
  expect(mockGuard.enabled).toBe(false);
  await click(owner.root.findByType(OpenEditor));
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
  await dismissSheet();
  expect(getPopupSession(mockParams.session, 'owner', 'playlist-editor')).toBeUndefined();
  expect(onSaved).not.toHaveBeenCalled();
  expect(onDeleted).not.toHaveBeenCalled();
});

test('dirty native swipe uses the navigator guard and only dispatches after confirmed discard', async () => {
  await openSheet();
  await act(async () => byLabel('Playlist name').props.onChangeText('Changed'));
  expect(mockGuard.enabled).toBe(true);
  await swipe();
  expect(confirmAction).toHaveBeenCalledWith('Discard changes?', expect.any(String), 'Discard');
  expect(mockNavigation.dispatch).not.toHaveBeenCalled();
  confirmAction.mockResolvedValue(true);
  const action = await swipe();
  expect(mockNavigation.dispatch).toHaveBeenCalledWith(action);
  await dismissSheet();
  expect(onSaved).not.toHaveBeenCalled();
});

test('iOS editor keeps its fixed controls outside one directly sized native track list', async () => {
  await openSheet();
  assertNativeSheetLayout(sheet.root, { list: true });
  await act(async () => byLabel('Playlist name').props.onChangeText('Changed'));
  await click(byLabel('Move First down'));
  assertNativeSheetLayout(sheet.root, { list: true });
});

test('busy save blocks swipe; success disables dirty guard before one close and delivers saved order after unmount', async () => {
  let resolve;
  updateOwnedPlaylist.mockImplementation(() => new Promise((done) => { resolve = done; }));
  await openSheet();
  await act(async () => byLabel('Playlist name').props.onChangeText('Changed'));
  await click(byLabel('Move First down'));
  await click(byLabel('Save playlist changes'));
  expect(mockGuard.enabled).toBe(true);
  await swipe();
  expect(mockNavigation.dispatch).not.toHaveBeenCalled();
  expect(confirmAction).not.toHaveBeenCalled();
  expect(updateOwnedPlaylist).toHaveBeenCalledWith('owner', 'playlist', expect.objectContaining({ title: 'Changed', trackIds: ['two', 'one'], expectedTrackIds: ['one', 'two'] }));
  const next = { ...playlist, title: 'Changed', songs: ['two', 'one'] };
  await act(async () => resolve(next));
  expect(mockGuard.enabled).toBe(false);
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(onSaved).not.toHaveBeenCalled();
  await act(async () => sheet.update(<PlaylistEditorScreen />));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  await dismissSheet();
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(onSaved).toHaveBeenCalledWith(next);
});

test('failed save retains edits and the dirty dismissal guard', async () => {
  updateOwnedPlaylist.mockRejectedValue(new Error('Try again later.'));
  await openSheet();
  await act(async () => byLabel('Playlist name').props.onChangeText('Changed'));
  await click(byLabel('Save playlist changes'));
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockGuard.enabled).toBe(true);
  expect(byLabel('Playlist name').props.value).toBe('Changed');
  expect(sheet.root.findByProps({ accessibilityRole: 'alert' }).props.children).toBe('Try again later.');
});

test('confirmed delete bypasses unsaved guard only after deletion and delays parent navigation until removal', async () => {
  let resolve;
  deleteOwnedPlaylist.mockImplementation(() => new Promise((done) => { resolve = done; }));
  confirmAction.mockResolvedValue(true);
  await openSheet();
  await act(async () => byLabel('Playlist name').props.onChangeText('Changed'));
  await click(byLabel('Delete playlist'));
  expect(confirmAction).toHaveBeenCalledTimes(1);
  await swipe();
  expect(mockNavigation.dispatch).not.toHaveBeenCalled();
  expect(mockRouter.back).not.toHaveBeenCalled();
  await act(async () => resolve());
  expect(mockGuard.enabled).toBe(false);
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(onDeleted).not.toHaveBeenCalled();
  await dismissSheet();
  expect(onDeleted).toHaveBeenCalledTimes(1);
  expect(confirmAction).toHaveBeenCalledTimes(1);
});

test('account change while saving prevents stale completion or navigation into the new account', async () => {
  let resolve;
  updateOwnedPlaylist.mockImplementation(() => new Promise((done) => { resolve = done; }));
  await openSheet();
  await click(byLabel('Save playlist changes'));
  mockUid = 'different-owner';
  await act(async () => { owner.update(<Launcher />); sheet.update(<PlaylistEditorScreen />); });
  expect(sheet.root.findAllByType('Redirect')).toHaveLength(1);
  await act(async () => resolve(playlist));
  expect(mockRouter.back).not.toHaveBeenCalled();
  await dismissSheet();
  expect(onSaved).not.toHaveBeenCalled();
  expect(onDeleted).not.toHaveBeenCalled();
});

test('disposing the owner while discard confirmation is open cancels its eventual navigation', async () => {
  let resolve;
  confirmAction.mockImplementation(() => new Promise((done) => { resolve = done; }));
  await openSheet();
  await act(async () => byLabel('Playlist name').props.onChangeText('Changed'));
  await swipe();
  await act(async () => owner.unmount()); owner = undefined;
  await act(async () => resolve(true));
  expect(mockNavigation.dispatch).not.toHaveBeenCalled();
  await dismissSheet();
  expect(onSaved).not.toHaveBeenCalled();
});
