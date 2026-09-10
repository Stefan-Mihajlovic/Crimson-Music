import { beforeEach, expect, jest, test } from '@jest/globals';
import { audiusFetch, getCurrentAudiusUserId } from '../src/services/audius-session';
import { clearAudiusCaches, resolveAudiusStreamUrl } from '../src/services/audius';

jest.mock('../src/services/audius-session', () => ({ audiusFetch: jest.fn(), getCurrentAudiusUserId: jest.fn() }));

beforeEach(() => {
  clearAudiusCaches();
  getCurrentAudiusUserId.mockReturnValue('listener');
});

test('stream resolution uses JSON without opening or probing the audio body, and coalesces concurrent playback', async () => {
  audiusFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: 'https://cdn.example/audio.mp3' }) });
  const urls = await Promise.all([resolveAudiusStreamUrl('track'), resolveAudiusStreamUrl('track')]);
  expect(urls).toEqual(['https://cdn.example/audio.mp3', 'https://cdn.example/audio.mp3']);
  expect(audiusFetch).toHaveBeenCalledTimes(1);
  const [path, init] = audiusFetch.mock.calls[0];
  expect(path).toBe('/tracks/track/stream?user_id=listener&no_redirect=true');
  expect(init.headers).toBeUndefined();
});

test('invalid stream metadata falls back to the authenticated Audius stream endpoint', async () => {
  audiusFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: 'file:///untrusted' }) });
  await expect(resolveAudiusStreamUrl('track')).resolves.toBe('https://api.audius.co/v1/tracks/track/stream?user_id=listener');
});
