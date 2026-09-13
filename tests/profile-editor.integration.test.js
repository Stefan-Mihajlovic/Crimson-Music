import React from 'react';
import { Platform, TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';
import * as ImagePicker from 'expo-image-picker';
import EditProfileScreen from '../src/app/(app)/(home)/edit-profile';

let mockUser;
let mockOffline;
let mockCurrentUid;
const mockUpdateProfile = jest.fn();
const mockSignIn = jest.fn();
const mockBack = jest.fn();
const mockRouter = { back: mockBack };

jest.mock('expo-router', () => ({
  Stack: { Screen: 'StackScreen' },
  useRouter: () => mockRouter,
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../src/providers/auth-provider', () => ({
  useAuth: () => ({ user: mockUser, updateProfile: mockUpdateProfile, signInWithAudius: mockSignIn }),
}));
jest.mock('../src/providers/settings-provider', () => ({ useAppSettings: () => ({ colors: {} }) }));
jest.mock('../src/providers/network-provider', () => ({ useNetwork: () => ({ isOffline: mockOffline }) }));
jest.mock('../src/services/audius-profile', () => ({ PROFILE_NAME_MAX_LENGTH: 32, PROFILE_PHOTO_MAX_BYTES: 10 * 1024 * 1024 }));
jest.mock('../src/services/audius-session', () => ({ getCurrentAudiusUserId: () => mockCurrentUid }));
jest.mock('../src/components/profile-images', () => ({ profileImageSource: (uri) => ({ uri }) }));

let root;
const initialPlatform = Platform.OS;
const button = (label) => root.root.findAll((node) => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === label)[0];
const saveButton = () => button('Save profile');
const photoButton = () => button('Change profile photo');
const preview = () => root.root.findByType('Image').props.source;
const input = () => root.root.findByType(TextInput);
const flush = () => act(async () => {});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockUser = { uid: 'first', DisplayName: 'First name', Username: 'first', ProfilePhoto: 'https://example.com/current.jpg', CanWrite: true };
  mockCurrentUid = 'first';
  mockOffline = false;
  mockUpdateProfile.mockResolvedValue(mockUser);
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
});
afterEach(async () => {
  if (root) await act(async () => { root.unmount(); });
  root = undefined;
  Platform.OS = initialPlatform;
});
const render = async () => { await act(async () => { root = create(<EditProfileScreen />); }); };
const changeName = async (name) => { await act(async () => input().props.onChangeText(name)); };
const pickPhoto = async () => { await act(async () => photoButton().props.onPress()); };
const save = async () => { await act(async () => saveButton().props.onPress()); };

test('canceling the photo picker preserves the current avatar and does not save anything', async () => {
  await render();
  await pickPhoto();
  expect(preview()).toEqual({ uri: mockUser.ProfilePhoto });
  expect(saveButton().props.disabled).toBe(true);
  expect(mockUpdateProfile).not.toHaveBeenCalled();
});

test('a native photo selection is only uploaded with the trimmed name when Save is pressed', async () => {
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cropped.jpg', mimeType: 'image/jpeg', fileName: 'cropped.jpg', fileSize: 512 }] });
  await render();
  await pickPhoto();
  await changeName('  New name  ');
  expect(preview()).toEqual({ uri: 'file:///cropped.jpg' });
  expect(mockUpdateProfile).not.toHaveBeenCalled();
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] }));
  await save();
  expect(mockUpdateProfile).toHaveBeenCalledWith({ name: 'New name', photo: { uri: 'file:///cropped.jpg', type: 'image/jpeg', name: 'cropped.jpg', size: 512, file: undefined } });
  expect(mockBack).toHaveBeenCalledTimes(1);
});

test('web photo selection preserves the actual File for multipart upload', async () => {
  Platform.OS = 'web';
  const file = { name: 'portrait.png', type: 'image/png', size: 2048 };
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'blob:portrait', file }] });
  await render();
  await pickPhoto();
  await save();
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false }));
  expect(mockUpdateProfile.mock.calls[0][0].photo.file).toBe(file);
});

test('a browser picker that never reports cancellation does not lock name editing or saving', async () => {
  Platform.OS = 'web';
  ImagePicker.launchImageLibraryAsync.mockReturnValue(new Promise(() => {}));
  await render();
  await pickPhoto();
  await changeName('Another name');
  expect(input().props.editable).toBe(true);
  expect(saveButton().props.disabled).toBe(false);
  await save();
  expect(mockUpdateProfile).toHaveBeenCalledWith({ name: 'Another name' });
});

test('failed saves preserve the draft and allow retry without navigating away', async () => {
  mockUpdateProfile.mockRejectedValueOnce(new Error('Could not save your profile. Try again.'));
  await render();
  await changeName('My new name');
  await save();
  expect(mockBack).not.toHaveBeenCalled();
  expect(input().props.value).toBe('My new name');
  expect(saveButton().props.disabled).toBe(false);
  expect(root.root.findAll((node) => node.props.accessibilityRole === 'alert').some((node) => node.props.children === 'Could not save your profile. Try again.')).toBe(true);
  await save();
  expect(mockBack).toHaveBeenCalledTimes(1);
});

test('a late save for an account that has changed cannot navigate the new account away', async () => {
  let finishSave;
  mockUpdateProfile.mockReturnValue(new Promise((resolve) => { finishSave = resolve; }));
  await render();
  await changeName('First edited name');
  await save();
  expect(saveButton().props.disabled).toBe(true);
  mockUser = { ...mockUser, uid: 'second', DisplayName: 'Second name' };
  mockCurrentUid = 'second';
  await act(async () => root.update(<EditProfileScreen />));
  expect(input().props.value).toBe('Second name');
  await act(async () => finishSave({ uid: 'first' }));
  expect(mockBack).not.toHaveBeenCalled();
});

test('a late photo selection cannot become the new account’s profile draft', async () => {
  let finishPicker;
  ImagePicker.launchImageLibraryAsync.mockReturnValue(new Promise((resolve) => { finishPicker = resolve; }));
  await render();
  await pickPhoto();
  mockUser = { ...mockUser, uid: 'second', DisplayName: 'Second name', ProfilePhoto: 'second.jpg' };
  mockCurrentUid = 'second';
  await act(async () => root.update(<EditProfileScreen />));
  await act(async () => finishPicker({ canceled: false, assets: [{ uri: 'file:///first-photo.jpg' }] }));
  expect(preview()).toEqual({ uri: 'second.jpg' });
  expect(saveButton().props.disabled).toBe(true);
});

test('offline and read-only sessions cannot submit changes', async () => {
  await render();
  await changeName('Changed');
  mockOffline = true;
  await act(async () => root.update(<EditProfileScreen />));
  expect(saveButton().props.disabled).toBe(true);
  await save();
  expect(mockUpdateProfile).not.toHaveBeenCalled();
  mockOffline = false;
  mockUser = { ...mockUser, CanWrite: false };
  await act(async () => root.update(<EditProfileScreen />));
  expect(input().props.editable).toBe(false);
  expect(photoButton().props.disabled).toBe(true);
  expect(saveButton().props.disabled).toBe(true);
});

test('a completed save after the editor unmounts cannot navigate another screen', async () => {
  let finishSave;
  mockUpdateProfile.mockReturnValue(new Promise((resolve) => { finishSave = resolve; }));
  await render();
  await changeName('Changed');
  await save();
  await act(async () => root.unmount());
  root = undefined;
  finishSave(mockUser);
  await flush();
  expect(mockBack).not.toHaveBeenCalled();
});


test('an oversized photo leaves the current photo intact and offers a useful error before saving', async () => {
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///large.jpg', mimeType: 'image/jpeg', fileSize: 11 * 1024 * 1024 }] });
  await render();
  await pickPhoto();
  expect(preview()).toEqual({ uri: mockUser.ProfilePhoto });
  expect(saveButton().props.disabled).toBe(true);
  expect(root.root.findAll((node) => node.props.accessibilityRole === 'alert').some((node) => node.props.children === 'Choose a photo smaller than 10 MB.')).toBe(true);
  expect(mockUpdateProfile).not.toHaveBeenCalled();
});
