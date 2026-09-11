import { expect, jest, test } from '@jest/globals';
import { AudiusSessionClient } from '../../src/services/audius-session-core';

test('web OAuth and API requests invoke browser fetch with its Window receiver', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const transport = jest.fn(function () {
    if (this !== globalThis) throw new TypeError('Illegal invocation');
    return Promise.resolve({ ok: true });
  });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: transport });
  try {
    const client = new AudiusSessionClient({ read: async () => null, write: async () => {} });
    await expect(client.raw('/oauth/token', { method: 'POST' })).resolves.toEqual({ ok: true });
    expect(transport).toHaveBeenCalledWith('https://api.audius.co/v1/oauth/token', expect.objectContaining({ method: 'POST' }));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'fetch', descriptor);
    else delete globalThis.fetch;
  }
});
