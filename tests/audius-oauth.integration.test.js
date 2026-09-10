import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

jest.mock('expo-auth-session', () => ({
  AuthRequest: jest.fn(),
  makeRedirectUri: jest.fn(() => 'https://crimson.example/oauth/callback'),
  ResponseType: { Code: 'code' },
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'after-first-unlock-this-device-only',
}));

const appIdentity = 'public-test-app-identity';
const redirectUri = 'crimsonmusic://oauth/callback';
const accountResponse = { data: { id: 'eP9k2', handle: 'listener', name: 'Audius Listener', profile_picture: { '480x480': 'https://images.example/avatar.jpg' } } };
const originalFetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
const originalClientId = process.env.EXPO_PUBLIC_AUDIUS_API_KEY;
let auth;
let expoAuth;
let secureStore;
let authResult;
let request;
let transport;

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_AUDIUS_API_KEY = appIdentity;
  transport = jest.fn(async (url) => {
    if (url.endsWith('/oauth/token')) return response({ access_token: 'listener-access-token', refresh_token: 'listener-refresh-token', expires_in: 3600, refresh_expires_in: 86400 });
    if (url.endsWith('/me')) return response(accountResponse);
    return response({});
  });
  Object.defineProperty(globalThis, 'fetch', { value: transport, configurable: true, writable: true });
  jest.resetModules();
  expoAuth = require('expo-auth-session');
  secureStore = require('expo-secure-store');
  authResult = { type: 'success', params: { code: 'authorization-code', state: 'expected-csrf-state' } };
  expoAuth.AuthRequest.mockImplementation((config) => {
    request = {
      state: 'expected-csrf-state',
      codeVerifier: 'private-pkce-verifier',
      makeAuthUrlAsync: jest.fn(async ({ authorizationEndpoint }) => {
        const url = new URL(authorizationEndpoint);
        url.searchParams.set('client_id', config.clientId);
        url.searchParams.set('api_key', config.extraParams.api_key);
        url.searchParams.set('response_type', config.responseType);
        url.searchParams.set('code_challenge', 'public-pkce-challenge');
        url.searchParams.set('code_challenge_method', 'S256');
        return url.toString();
      }),
      promptAsync: jest.fn(async () => authResult),
    };
    return request;
  });
  auth = require('../src/services/audius-session');
});

afterEach(() => {
  if (originalFetchDescriptor) Object.defineProperty(globalThis, 'fetch', originalFetchDescriptor);
  else delete globalThis.fetch;
  if (originalClientId === undefined) delete process.env.EXPO_PUBLIC_AUDIUS_API_KEY;
  else process.env.EXPO_PUBLIC_AUDIUS_API_KEY = originalClientId;
});

test('native Audius login requests write access with PKCE and stores the verified listener profile securely', async () => {
  const account = await auth.loginAudius();
  expect(expoAuth.AuthRequest).toHaveBeenCalledWith(expect.objectContaining({
    clientId: appIdentity,
    redirectUri,
    responseType: 'code',
    scopes: ['write'],
    usePKCE: true,
    extraParams: { api_key: appIdentity, response_mode: 'query', display: 'fullScreen' },
  }));
  const authorizationUrl = new URL(request.promptAsync.mock.calls[0][1].url);
  expect(authorizationUrl.origin + authorizationUrl.pathname).toBe('https://api.audius.co/v1/oauth/authorize');
  expect(authorizationUrl.searchParams.get('api_key')).toBe(appIdentity);
  expect(authorizationUrl.searchParams.has('client_id')).toBe(false);
  expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256');
  expect(authorizationUrl.toString()).not.toContain('private-pkce-verifier');
  const [tokenUrl, tokenInit] = transport.mock.calls[0];
  expect(tokenUrl).toBe('https://api.audius.co/v1/oauth/token');
  expect(tokenInit.method).toBe('POST');
  expect(tokenInit.headers).toEqual({ 'Content-Type': 'application/json' });
  expect(JSON.parse(tokenInit.body)).toEqual({
    grant_type: 'authorization_code', code: 'authorization-code', code_verifier: 'private-pkce-verifier', client_id: appIdentity, redirect_uri: redirectUri,
  });
  expect(transport.mock.calls[1]).toEqual([
    'https://api.audius.co/v1/me',
    expect.objectContaining({ headers: { Authorization: 'Bearer listener-access-token' } }),
  ]);
  expect(account).toEqual({ id: 'eP9k2', handle: 'listener', name: 'Audius Listener', picture: 'https://images.example/avatar.jpg' });
  expect(auth.getCurrentAudiusUserId()).toBe('eP9k2');
  expect(auth.canWriteAudius()).toBe(true);
  expect(secureStore.setItemAsync).toHaveBeenCalledWith('crimson.audius.session.v1', expect.any(String), { keychainAccessible: secureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  expect(JSON.parse(secureStore.setItemAsync.mock.calls[0][1])).toEqual(expect.objectContaining({ accessToken: 'listener-access-token', refreshToken: 'listener-refresh-token', scope: 'write', account }));
});

test.each([
  ['cancel', { type: 'cancel' }],
  ['dismiss', { type: 'dismiss' }],
  ['denied consent', { type: 'error', params: { error: 'access_denied', state: 'expected-csrf-state' } }],
])('%s never exchanges tokens or persists an Audius account', async (_, result) => {
  authResult = result;
  await expect(auth.loginAudius()).rejects.toMatchObject({ code: 'cancelled' });
  expect(transport).not.toHaveBeenCalled();
  expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  expect(auth.getAudiusSession()).toBeNull();
});

test('a mismatched callback state cannot exchange an authorization code', async () => {
  authResult.params.state = 'unexpected-csrf-state';
  await expect(auth.loginAudius()).rejects.toThrow('could not be verified');
  expect(transport).not.toHaveBeenCalled();
  expect(secureStore.setItemAsync).not.toHaveBeenCalled();
});

test('a canceled attempt releases the pending login so the listener can retry', async () => {
  authResult = { type: 'cancel' };
  await expect(auth.loginAudius()).rejects.toMatchObject({ code: 'cancelled' });
  authResult = { type: 'success', params: { code: 'retry-code', state: 'expected-csrf-state' } };
  await expect(auth.loginAudius()).resolves.toMatchObject({ id: 'eP9k2' });
  expect(expoAuth.AuthRequest).toHaveBeenCalledTimes(2);
  expect(JSON.parse(transport.mock.calls[0][1].body).code).toBe('retry-code');
});

test('an incomplete token exchange never creates a saved session', async () => {
  transport.mockResolvedValueOnce(response({ access_token: 'incomplete-access-token' }));
  await expect(auth.loginAudius()).rejects.toThrow('incomplete login session');
  expect(transport).toHaveBeenCalledTimes(1);
  expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  expect(auth.getAudiusSession()).toBeNull();
});

test('profile retrieval failure never persists unverified credentials', async () => {
  transport.mockImplementation(async (url) => url.endsWith('/oauth/token')
    ? response({ access_token: 'listener-access-token', refresh_token: 'listener-refresh-token' })
    : response({}, 401));
  await expect(auth.loginAudius()).rejects.toThrow('Could not load your Audius account');
  expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  expect(auth.getAudiusSession()).toBeNull();
});

test('media headers authenticate Audius streams without exposing credentials to a CDN', async () => {
  await auth.loginAudius();
  expect(await auth.audiusMediaHeaders('https://api.audius.co/v1/tracks/track-id/stream')).toEqual({ Authorization: 'Bearer listener-access-token' });
  expect(await auth.audiusMediaHeaders('https://cdn.example/v1/tracks/track-id/stream')).toBeUndefined();
  expect(await auth.audiusMediaHeaders('https://api.audius.co.attacker.example/v1/tracks/track-id/stream')).toBeUndefined();
  expect(await auth.audiusMediaHeaders('https://api.audius.co/v1/users/eP9k2')).toBeUndefined();
  expect(transport).toHaveBeenCalledTimes(2);
});
