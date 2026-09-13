import { File } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Platform } from 'react-native';
import { updateAudiusProfile } from '../src/services/audius-profile';
import { audiusRequest } from '../src/services/audius-session';
import { TextDecoder, TextEncoder } from 'node:util';
import RNFormData from 'react-native/Libraries/Network/FormData';
const { installFormDataPatch } = jest.requireActual('expo/src/winter/FormData');
const { convertFormDataAsync } = jest.requireActual('expo/src/winter/fetch/convertFormData');

// Use the installed SDK's actual FormData and multipart serializer. A hand-written
// append() mock misses Expo 57's rejection of React Native's legacy URI objects.
const ExpoFormData = installFormDataPatch(RNFormData);
globalThis.TextEncoder ??= TextEncoder;
globalThis.TextDecoder ??= TextDecoder;

test('Expo 57 rejects the legacy native URI upload object before sending HTTP', async () => {
  const form = new ExpoFormData();
  form.append('template', 'img_square');
  form.append('files', { uri: 'file:///var/mobile/Containers/Data/Application/example/Library/Caches/ImagePicker/portrait.jpg', name: 'portrait.jpg', type: 'image/jpeg' });
  await expect(convertFormDataAsync(form)).rejects.toThrow('Unsupported FormDataPart implementation');
});

test('the installed Expo multipart serializer sends a binary File with its filename and MIME type', async () => {
  // Node File supplies real bytes() data, the same interface consumed from an
  // expo-file-system File on device, without mocking the multipart serializer.
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x41, 0x42, 0x43, 0xff, 0xd9]);
  const photo = new File([jpegBytes], 'portrait.jpg', { type: 'image/jpeg' });
  const form = new ExpoFormData();
  form.append('template', 'img_square');
  form.append('files', photo);
  const { body, boundary } = await convertFormDataAsync(form, 'crimson-photo-boundary');
  const multipart = new TextDecoder().decode(body);
  expect(boundary).toBe('crimson-photo-boundary');
  expect(multipart).toContain('name="template"\r\n\r\nimg_square');
  expect(multipart).toContain('name="files"; filename="portrait.jpg"');
  expect(multipart).toContain('content-type: image/jpeg');
  expect(Buffer.from(body).includes(Buffer.from(jpegBytes))).toBe(true);
  expect(multipart.endsWith('--crimson-photo-boundary--\r\n')).toBe(true);
});


jest.mock('../src/services/audius', () => ({ clearAudiusCaches: jest.fn() }));
jest.mock('../src/services/account-lifecycle', () => ({ isAccountDeleted: () => false, registerAccountCleanup: jest.fn() }));
jest.mock('../src/services/audius-session', () => ({
  AudiusSessionError: class extends Error {},
  getAudiusSession: () => ({ scope: 'write', account: { id: 'test-listener', name: 'Unchanged name' } }),
  getAudiusSessionRevision: () => 1,
  audiusRequest: jest.fn(async () => ({ transaction_hash: 'test-only-confirmation' })),
  commitAudiusProfile: jest.fn(async (_, patch) => ({ id: 'test-listener', name: 'Unchanged name', ...patch })),
}));
jest.mock('expo-file-system', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { fileURLToPath } = require('node:url');
  // Native filesystem access is the only substituted leaf. The production
  // service builds its own form; installed Expo code serializes real PNG bytes.
  return { File: class {
    constructor(uri) { this.uri = uri; this.path = fileURLToPath(uri); }
    get exists() { return fs.existsSync(this.path); }
    get size() { return fs.statSync(this.path).size; }
    get name() { return path.basename(this.path); }
    get type() { return 'image/png'; }
    async bytes() { return new Uint8Array(fs.readFileSync(this.path)); }
  } };
});

test.each(['ios', 'android'])('%s production photo upload survives the actual Expo multipart serializer', async (os) => {
  const originalPlatform = Platform.OS;
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const originalFormData = Object.getOwnPropertyDescriptor(globalThis, 'FormData');
  const fixture = path.join(__dirname, '../assets/images/favicon.png');
  const imageBytes = fs.readFileSync(fixture);
  const storage = 'https://creatornode.audius.co';
  let encoded;
  const respond = (body) => ({ ok: true, status: 200, json: async () => body });
  const transport = jest.fn(async (url, options) => {
    if (url === 'https://api.audius.co/health_check') return respond({ data: { network: { content_nodes: [{ endpoint: storage }] } } });
    if (url === `${storage}/health_check`) return respond({ data: { diskHasSpace: true } });
    if (url === `${storage}/uploads`) {
      encoded = await convertFormDataAsync(options.body, 'crimson-photo-production-boundary');
      expect(options.credentials).toBe('omit');
      expect(options.headers?.Authorization).toBeUndefined();
      return respond([{ status: 'done', orig_file_cid: 'testImageCid' }]);
    }
    throw new Error(`Unexpected request ${url}`);
  });
  try {
    Platform.OS = os;
    Object.defineProperty(globalThis, 'FormData', { value: ExpoFormData, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'fetch', { value: transport, configurable: true, writable: true });
    await updateAudiusProfile('test-listener', {
      name: 'Unchanged name',
      photo: { uri: pathToFileURL(fixture).href, name: 'favicon.png', type: 'image/png', size: imageBytes.byteLength },
    });
    const multipart = new TextDecoder().decode(encoded.body);
    expect(multipart).toContain('name="template"\r\n\r\nimg_square');
    expect(multipart).toContain('name="files"; filename="favicon.png"');
    expect(multipart).toContain('content-type: image/png');
    expect(Buffer.from(encoded.body).includes(imageBytes)).toBe(true);
    expect(audiusRequest).toHaveBeenCalledWith('/users/test-listener', { method: 'PUT', body: { profile_picture: 'testImageCid', profile_picture_sizes: 'testImageCid' } });
    if (process.env.CRIMSON_UPLOAD_SMOKE === '1') {
      const destination = path.join(__dirname, '../.build/profile-upload-fix');
      fs.mkdirSync(destination, { recursive: true });
      fs.writeFileSync(path.join(destination, 'probe.multipart'), encoded.body);
      fs.writeFileSync(path.join(destination, 'probe.metadata.json'), JSON.stringify({ boundary: encoded.boundary, contentType: `multipart/form-data; boundary=${encoded.boundary}`, bytes: encoded.body.length, imageBytes: imageBytes.byteLength, source: 'assets/images/favicon.png' }, null, 2));
    }
  } finally {
    Platform.OS = originalPlatform;
    if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
    else delete globalThis.fetch;
    if (originalFormData) Object.defineProperty(globalThis, 'FormData', originalFormData);
    else delete globalThis.FormData;
  }
});
