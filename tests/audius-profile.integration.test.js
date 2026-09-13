import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { File } from 'node:buffer';

jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('../src/services/audius', () => ({ clearAudiusCaches: jest.fn() }));
jest.mock('../src/services/account-lifecycle', () => ({
  isAccountDeleted: jest.fn(() => false),
  registerAccountCleanup: jest.fn(),
}));
jest.mock('../src/services/audius-session', () => ({
  audiusRequest: jest.fn(),
  getAudiusSession: jest.fn(),
  getAudiusSessionRevision: jest.fn(),
  commitAudiusProfile: jest.fn(),
  AudiusSessionError: class extends Error {
    constructor(message, code) { super(message); this.code = code; }
  },
}));

const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
const originalFormDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'FormData');
const storage = 'https://creatornode.audius.co';
const cid = 'baeaaaiqsecu5voyphxgni2fxzd3tmgkw73j5tdfrsvp35y5baek5cmxsro7ei';
const originalAccount = { id: 'Od3bZ', name: 'Original name', handle: 'listener', picture: 'https://images.example/old.jpg' };
const nativePhoto = { uri: 'file:///portrait.jpg', name: 'portrait.jpg', type: 'image/jpeg', size: 1024 };
let profile;
let sessionApi;
let lifecycle;
let caches;
let platform;
let initialPlatform;
let session;
let revision;
let transport;
let fileSystem;

function nativeFile(uri, overrides = {}) {
  return {
    uri,
    name: uri.split('/').pop(),
    type: 'image/jpeg',
    exists: true,
    size: 1024,
    bytes: jest.fn(async () => new Uint8Array([0xff, 0xd8, 0xff, 0xd9])),
    ...overrides,
  };
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function uploadRequests() { return transport.mock.calls.filter(([url]) => url.endsWith('/uploads')); }

beforeEach(() => {
  jest.resetModules();
  platform = require('react-native').Platform;
  initialPlatform = platform.OS;
  platform.OS = 'ios';
  sessionApi = require('../src/services/audius-session');
  fileSystem = require('expo-file-system');
  fileSystem.File.mockImplementation((uri) => nativeFile(uri));
  lifecycle = require('../src/services/account-lifecycle');
  caches = require('../src/services/audius');
  session = { account: { ...originalAccount }, scope: 'write' };
  revision = 7;
  sessionApi.getAudiusSession.mockImplementation(() => session);
  sessionApi.getAudiusSessionRevision.mockImplementation(() => revision);
  sessionApi.audiusRequest.mockResolvedValue({ transaction_hash: 'confirmed-transaction' });
  sessionApi.commitAudiusProfile.mockImplementation(async (_, patch) => ({ ...originalAccount, ...patch }));
  transport = jest.fn(async (url) => {
    if (url === 'https://api.audius.co/health_check') return response({ data: { network: { content_nodes: [{ endpoint: storage }] } } });
    if (url === `${storage}/health_check`) return response({ data: { diskHasSpace: true } });
    if (url === `${storage}/uploads`) return response([{ id: 'upload-1', status: 'done', orig_file_cid: cid }]);
    throw new Error(`Unexpected request: ${url}`);
  });
  Object.defineProperty(globalThis, 'fetch', { value: transport, configurable: true, writable: true });
  // Preserve the exact native File / browser File passed to the transport.
  // HTTP boundary encoding is supplied by each platform's fetch implementation.
  Object.defineProperty(globalThis, 'FormData', {
    value: class {
      parts = [];
      append(...part) { this.parts.push(part); }
    },
    configurable: true,
    writable: true,
  });
  profile = require('../src/services/audius-profile');
});

afterEach(() => {
  platform.OS = initialPlatform;
  jest.useRealTimers();
  if (originalFetchDescriptor) Object.defineProperty(globalThis, 'fetch', originalFetchDescriptor);
  else delete globalThis.fetch;
  if (originalFormDescriptor) Object.defineProperty(globalThis, 'FormData', originalFormDescriptor);
  else delete globalThis.FormData;
});

test('a name-only edit sends a trimmed partial PUT and commits only after Audius confirms it', async () => {
  const result = await profile.updateAudiusProfile(originalAccount.id, { name: '  New name  ' });
  expect(transport).not.toHaveBeenCalled();
  expect(sessionApi.audiusRequest).toHaveBeenCalledWith('/users/Od3bZ', { method: 'PUT', body: { name: 'New name' } });
  expect(sessionApi.commitAudiusProfile).toHaveBeenCalledWith('Od3bZ', { name: 'New name' }, 7);
  expect(sessionApi.commitAudiusProfile.mock.invocationCallOrder[0]).toBeGreaterThan(sessionApi.audiusRequest.mock.invocationCallOrder[0]);
  expect(result).toEqual({ ...originalAccount, name: 'New name' });
  expect(caches.clearAudiusCaches).toHaveBeenCalledTimes(1);
});

test.each(['ios', 'android'])('%s photo upload uses an Expo File with readable bytes and both CID fields on the PUT', async (os) => {
  platform.OS = os;
  const result = await profile.updateAudiusProfile(originalAccount.id, { name: originalAccount.name, photo: nativePhoto });
  const [url, init] = uploadRequests()[0];
  expect(url).toBe(`${storage}/uploads`);
  expect(init.method).toBe('POST');
  expect(fileSystem.File).toHaveBeenCalledWith(nativePhoto.uri);
  const file = fileSystem.File.mock.results[0].value;
  expect(typeof file.bytes).toBe('function');
  expect(init.body.parts).toEqual([['template', 'img_square'], ['files', file]]);
  for (const [, request] of transport.mock.calls) {
    expect(request.credentials).toBe('omit');
    expect(request.headers).toBeUndefined();
  }
  expect(sessionApi.audiusRequest).toHaveBeenCalledWith('/users/Od3bZ', {
    method: 'PUT', body: { profile_picture: cid, profile_picture_sizes: cid },
  });
  expect(result.picture).toBe(`${storage}/content/${cid}/480x480.jpg`);
  expect(sessionApi.commitAudiusProfile).toHaveBeenCalledWith('Od3bZ', { picture: result.picture }, 7);
});

test('web uploads the actual selected File and preserves an unchanged display name', async () => {
  platform.OS = 'web';
  const file = new File(['photo bytes'], 'portrait.png', { type: 'image/png' });
  await profile.updateAudiusProfile(originalAccount.id, {
    name: originalAccount.name,
    photo: { uri: 'blob:portrait', name: file.name, type: file.type, file },
  });
  const form = uploadRequests()[0][1].body;
  expect(form.parts[1][0]).toBe('files');
  expect(form.parts[1][1]).toBe(file);
  expect(form.parts[1][2]).toBe('portrait.png');
  expect(fileSystem.File).not.toHaveBeenCalled();
  expect(sessionApi.audiusRequest.mock.calls[0][1].body).not.toHaveProperty('name');
});

test.each([
  ['missing', { exists: false }],
  ['empty', { size: 0 }],
  ['oversized', { size: 10 * 1024 * 1024 + 1 }],
])('a %s native file is rejected before upload even when the picker reported a valid size', async (_, overrides) => {
  fileSystem.File.mockImplementation((uri) => nativeFile(uri, overrides));
  await expect(profile.updateAudiusProfile(originalAccount.id, { name: 'New name', photo: nativePhoto })).rejects.toThrow(/photo|choose|file/i);
  expect(uploadRequests()).toHaveLength(0);
  expect(sessionApi.audiusRequest).not.toHaveBeenCalled();
  expect(sessionApi.commitAudiusProfile).not.toHaveBeenCalled();
});

test('an unreadable native file produces an actionable photo error without a misleading network failure', async () => {
  fileSystem.File.mockImplementation(() => { throw new Error('Native path validation failed'); });
  await expect(profile.updateAudiusProfile(originalAccount.id, { name: 'New name', photo: nativePhoto })).rejects.toThrow(/photo|choose/i);
  expect(uploadRequests()).toHaveLength(0);
  expect(sessionApi.audiusRequest).not.toHaveBeenCalled();
});

test('a failed photo upload cannot change the name or commit a local-only avatar', async () => {
  transport.mockImplementation(async (url) => url.endsWith('/uploads')
    ? response({ error: 'invalid image' }, 422)
    : response({ data: { diskHasSpace: true } }));
  await expect(profile.updateAudiusProfile(originalAccount.id, { name: 'New name', photo: nativePhoto })).rejects.toThrow('could not process');
  expect(sessionApi.audiusRequest).not.toHaveBeenCalled();
  expect(sessionApi.commitAudiusProfile).not.toHaveBeenCalled();
  expect(caches.clearAudiusCaches).not.toHaveBeenCalled();
});

test.each([{}, { success: false }, { data: { transaction_hash: 'wrong-envelope' } }])('unconfirmed write response %j never updates the local account', async (reply) => {
  sessionApi.audiusRequest.mockResolvedValue(reply);
  await expect(profile.updateAudiusProfile(originalAccount.id, { name: 'New name' })).rejects.toThrow('did not confirm');
  expect(sessionApi.commitAudiusProfile).not.toHaveBeenCalled();
  expect(caches.clearAudiusCaches).not.toHaveBeenCalled();
});

test.each(['logout', 'switch', 'reconnect', 'delete'])('%s during photo upload prevents the profile PUT', async (action) => {
  const gate = deferred();
  const started = deferred();
  transport.mockImplementation(async (url) => {
    if (url.endsWith('/uploads')) { started.resolve(); return gate.promise; }
    return response({ data: { diskHasSpace: true } });
  });
  const saving = profile.updateAudiusProfile(originalAccount.id, { name: 'New name', photo: nativePhoto });
  const rejected = expect(saving).rejects.toMatchObject({ code: 'cancelled' });
  await started.promise;
  if (action === 'logout') session = null;
  if (action === 'switch') session = { ...session, account: { ...session.account, id: 'Other' } };
  if (action === 'reconnect') revision += 1;
  if (action === 'delete') lifecycle.isAccountDeleted.mockReturnValue(true);
  gate.resolve(response([{ id: 'upload-1', status: 'done', orig_file_cid: cid }]));
  await rejected;
  expect(sessionApi.audiusRequest).not.toHaveBeenCalled();
  expect(sessionApi.commitAudiusProfile).not.toHaveBeenCalled();
});

test('switching accounts while the PUT is in flight cannot commit its result into the next account', async () => {
  const gate = deferred();
  sessionApi.audiusRequest.mockReturnValue(gate.promise);
  const saving = profile.updateAudiusProfile(originalAccount.id, { name: 'New name' });
  const rejected = expect(saving).rejects.toMatchObject({ code: 'cancelled' });
  revision += 1;
  gate.resolve({ transaction_hash: 'confirmed-transaction' });
  await rejected;
  expect(sessionApi.commitAudiusProfile).not.toHaveBeenCalled();
});

test('a read-only session is rejected before any upload or profile write', async () => {
  session.scope = 'read';
  await expect(profile.updateAudiusProfile(originalAccount.id, { name: 'New name', photo: nativePhoto })).rejects.toMatchObject({ code: 'read_only' });
  expect(transport).not.toHaveBeenCalled();
  expect(sessionApi.audiusRequest).not.toHaveBeenCalled();
});

test.each(['   ', 'x'.repeat(33), 'First\nLast', 'First\u0000Last'])('invalid display name %j is rejected before any upload or write', async (name) => {
  await expect(profile.updateAudiusProfile(originalAccount.id, { name, photo: nativePhoto })).rejects.toThrow('Enter a display name');
  expect(transport).not.toHaveBeenCalled();
  expect(sessionApi.audiusRequest).not.toHaveBeenCalled();
});

test('an unchanged profile does not write or invalidate caches', async () => {
  await expect(profile.updateAudiusProfile(originalAccount.id, { name: originalAccount.name })).resolves.toEqual(originalAccount);
  expect(transport).not.toHaveBeenCalled();
  expect(sessionApi.audiusRequest).not.toHaveBeenCalled();
  expect(sessionApi.commitAudiusProfile).not.toHaveBeenCalled();
  expect(caches.clearAudiusCaches).not.toHaveBeenCalled();
});

test('a duplicate Save is blocked until the first request settles, then a retry is allowed', async () => {
  const gate = deferred();
  sessionApi.audiusRequest.mockReturnValueOnce(gate.promise);
  const saving = profile.updateAudiusProfile(originalAccount.id, { name: 'New name' });
  await expect(profile.updateAudiusProfile(originalAccount.id, { name: 'Another name' })).rejects.toThrow('already being saved');
  gate.resolve({ transaction_hash: 'confirmed-transaction' });
  await saving;
  await expect(profile.updateAudiusProfile(originalAccount.id, { name: 'Another name' })).resolves.toMatchObject({ name: 'Another name' });
  expect(sessionApi.audiusRequest).toHaveBeenCalledTimes(2);
});

test('a pending image is polled on the same storage node without uploading twice', async () => {
  jest.useFakeTimers();
  const started = deferred();
  transport.mockImplementation(async (url) => {
    if (url.endsWith('/uploads')) { started.resolve(); return response([{ id: 'upload-1', status: 'busy' }]); }
    if (url.endsWith('/uploads/upload-1')) return response({ id: 'upload-1', status: 'done', orig_file_cid: cid });
    return response({ data: { diskHasSpace: true } });
  });
  const saving = profile.updateAudiusProfile(originalAccount.id, { name: 'New name', photo: nativePhoto });
  await started.promise;
  await jest.advanceTimersByTimeAsync(3000);
  await expect(saving).resolves.toMatchObject({ name: 'New name' });
  expect(uploadRequests()).toHaveLength(1);
  expect(transport).toHaveBeenCalledWith(`${storage}/uploads/upload-1`, expect.objectContaining({ credentials: 'omit' }));
});

function mockPendingUpload(poll) {
  const started = deferred();
  transport.mockImplementation(async (url) => {
    if (url.endsWith('/uploads')) { started.resolve(); return response([{ id: 'upload-1', status: 'busy' }]); }
    if (url === `${storage}/uploads/upload-1`) return poll();
    return response({ data: { diskHasSpace: true } });
  });
  return started.promise;
}

test('transient network and server polling errors recover without resending the photo', async () => {
  jest.useFakeTimers();
  const poll = jest.fn()
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValueOnce(response({}, 503))
    .mockResolvedValueOnce(response({ id: 'upload-1', status: 'done', orig_file_cid: cid }));
  const started = mockPendingUpload(poll);
  const saving = profile.updateAudiusProfile(originalAccount.id, { name: 'New name', photo: nativePhoto });
  await started;
  await jest.advanceTimersByTimeAsync(9000);
  await expect(saving).resolves.toMatchObject({ name: 'New name' });
  expect(poll).toHaveBeenCalledTimes(3);
  expect(uploadRequests()).toHaveLength(1);
  expect(sessionApi.audiusRequest).toHaveBeenCalledTimes(1);
});

test('a successful pending status resets consecutive failures and cannot redirect polling to another upload', async () => {
  jest.useFakeTimers();
  const poll = jest.fn()
    .mockResolvedValueOnce(response({}, 503))
    .mockResolvedValueOnce(response({}, 503))
    .mockResolvedValueOnce(response({ id: 'different-id', status: 'busy' }))
    .mockResolvedValueOnce(response({}, 503))
    .mockResolvedValueOnce(response({}, 503))
    .mockResolvedValueOnce(response({ id: 'upload-1', status: 'done', orig_file_cid: cid }));
  const started = mockPendingUpload(poll);
  const saving = profile.updateAudiusProfile(originalAccount.id, { name: 'New name', photo: nativePhoto });
  await started;
  await jest.advanceTimersByTimeAsync(18_000);
  await expect(saving).resolves.toMatchObject({ name: 'New name' });
  expect(poll).toHaveBeenCalledTimes(6);
  expect(uploadRequests()).toHaveLength(1);
  expect(transport.mock.calls.filter(([url]) => url.includes('/uploads/')).every(([url]) => url === `${storage}/uploads/upload-1`)).toBe(true);
});

test('three consecutive network polling failures stop with a readable error and never update the account', async () => {
  jest.useFakeTimers();
  const poll = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
  const started = mockPendingUpload(poll);
  const saving = profile.updateAudiusProfile(originalAccount.id, { name: 'New name', photo: nativePhoto });
  const rejected = expect(saving).rejects.toThrow('Check your connection');
  await started;
  await jest.advanceTimersByTimeAsync(30_000);
  await rejected;
  expect(poll).toHaveBeenCalledTimes(3);
  expect(uploadRequests()).toHaveLength(1);
  expect(sessionApi.audiusRequest).not.toHaveBeenCalled();
  expect(sessionApi.commitAudiusProfile).not.toHaveBeenCalled();
});

test('a processing rejection is terminal and is not retried like a connection failure', async () => {
  jest.useFakeTimers();
  const poll = jest.fn().mockResolvedValue(response({ status: 'error' }, 422));
  const started = mockPendingUpload(poll);
  const saving = profile.updateAudiusProfile(originalAccount.id, { name: 'New name', photo: nativePhoto });
  const rejected = expect(saving).rejects.toThrow('could not process');
  await started;
  await jest.advanceTimersByTimeAsync(30_000);
  await rejected;
  expect(poll).toHaveBeenCalledTimes(1);
  expect(sessionApi.audiusRequest).not.toHaveBeenCalled();
});

test('a processing timeout status ends polling immediately instead of waiting for the overall deadline', async () => {
  jest.useFakeTimers();
  const poll = jest.fn().mockResolvedValue(response({ id: 'upload-1', status: 'timeout' }));
  const started = mockPendingUpload(poll);
  const saving = profile.updateAudiusProfile(originalAccount.id, { name: 'New name', photo: nativePhoto });
  const rejected = expect(saving).rejects.toThrow('processing timed out');
  await started;
  await jest.advanceTimersByTimeAsync(30_000);
  await rejected;
  expect(poll).toHaveBeenCalledTimes(1);
  expect(sessionApi.audiusRequest).not.toHaveBeenCalled();
});

test('successful busy responses cannot extend the overall processing deadline', async () => {
  jest.useFakeTimers();
  const poll = jest.fn().mockResolvedValue(response({ id: 'upload-1', status: 'busy' }));
  const started = mockPendingUpload(poll);
  const saving = profile.updateAudiusProfile(originalAccount.id, { name: 'New name', photo: nativePhoto });
  const rejected = expect(saving).rejects.toThrow('could not finish processing');
  await started;
  await jest.advanceTimersByTimeAsync(120_000);
  await rejected;
  const countAtDeadline = poll.mock.calls.length;
  await jest.advanceTimersByTimeAsync(30_000);
  expect(poll).toHaveBeenCalledTimes(countAtDeadline);
  expect(countAtDeadline).toBeLessThanOrEqual(40);
  expect(uploadRequests()).toHaveLength(1);
  expect(sessionApi.audiusRequest).not.toHaveBeenCalled();
});
