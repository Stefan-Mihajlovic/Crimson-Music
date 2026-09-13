import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
const artwork = {
  '150x150': 'https://images.example/cover/150x150.jpg',
  '480x480': 'https://images.example/cover/480x480.jpg',
  '1000x1000': 'https://images.example/cover/1000x1000.jpg',
};
let getWelcomeArtwork;
let transport;
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  jest.resetModules();
  transport = jest.fn(async () => response({ data: [{ artwork }] }));
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: transport });
  ({ getWelcomeArtwork } = require('../src/services/welcome-artwork'));
});
afterEach(() => {
  jest.useRealTimers();
  if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
  else delete globalThis.fetch;
});

test('welcome artwork loads public trending covers without account credentials', async () => {
  await expect(getWelcomeArtwork()).resolves.toEqual([artwork['480x480']]);
  expect(transport).toHaveBeenCalledWith('https://api.audius.co/v1/tracks/trending?limit=24', {
    signal: expect.any(AbortSignal), credentials: 'omit',
  });
});

test('data saver selects small images from the same cached response', async () => {
  await getWelcomeArtwork();
  await expect(getWelcomeArtwork({ dataSaver: true })).resolves.toEqual([artwork['150x150']]);
  expect(transport).toHaveBeenCalledTimes(1);
});

test('invalid image schemes and credentials are filtered, with safe resolution fallbacks and no duplicates', async () => {
  transport.mockResolvedValue(response({ data: [
    { artwork },
    { artwork },
    { artwork: { '480x480': 'http://images.example/insecure.jpg', '150x150': 'https://images.example/safe.jpg' } },
    { artwork: { '480x480': 'https://user:password@images.example/private.jpg' } },
    { artwork: { '480x480': 'file:///private.jpg' } },
    { artwork: { '480x480': 'data:image/png;base64,abcd' } },
    { artwork: { '480x480': 10 } },
    {}, null,
  ] }));
  await expect(getWelcomeArtwork()).resolves.toEqual([artwork['480x480'], 'https://images.example/safe.jpg']);
});

test.each([null, {}, { data: null }, { data: {} }, { data: [] }, { data: [null, 1, {}, { artwork: {} }] }])('malformed or empty response %j keeps the bundled fallback', async (payload) => {
  transport.mockResolvedValue(response(payload));
  await expect(getWelcomeArtwork()).resolves.toEqual([]);
});

test('404 and malformed JSON fail gracefully without caching a failed result', async () => {
  transport.mockResolvedValueOnce(response({}, 404));
  await expect(getWelcomeArtwork()).resolves.toEqual([]);
  transport.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } });
  await expect(getWelcomeArtwork()).resolves.toEqual([]);
  await expect(getWelcomeArtwork()).resolves.toEqual([artwork['480x480']]);
  expect(transport).toHaveBeenCalledTimes(3);
});

test('successful artwork is cached for one hour and refreshes when it expires', async () => {
  jest.useFakeTimers();
  await getWelcomeArtwork();
  await jest.advanceTimersByTimeAsync(60 * 60 * 1000 - 1);
  await getWelcomeArtwork();
  expect(transport).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  await getWelcomeArtwork();
  expect(transport).toHaveBeenCalledTimes(2);
});

test('a stalled fetch aborts at eight seconds and resolves to the bundled fallback', async () => {
  jest.useFakeTimers();
  transport.mockImplementation((_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
  }));
  const loading = getWelcomeArtwork();
  await jest.advanceTimersByTimeAsync(8000);
  await expect(loading).resolves.toEqual([]);
  expect(transport.mock.calls[0][1].signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test('unmount cancellation aborts the pending request and does not cache its late response', async () => {
  let finish;
  transport.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  const controller = new AbortController();
  const loading = getWelcomeArtwork({ signal: controller.signal });
  controller.abort();
  finish(response({ data: [{ artwork }] }));
  await expect(loading).resolves.toEqual([]);
  expect(transport.mock.calls[0][1].signal.aborted).toBe(true);
  await getWelcomeArtwork();
  expect(transport).toHaveBeenCalledTimes(2);
});

test('an already canceled caller does not start a request', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(getWelcomeArtwork({ signal: controller.signal })).resolves.toEqual([]);
  expect(transport).not.toHaveBeenCalled();
});

test('a larger than requested response cannot exceed 24 covers', async () => {
  transport.mockResolvedValue(response({ data: Array.from({ length: 50 }, (_, index) => ({ artwork: { '480x480': `https://images.example/${index}.jpg` } })) }));
  await expect(getWelcomeArtwork()).resolves.toHaveLength(24);
});
