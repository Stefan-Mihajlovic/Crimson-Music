import { AuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { accountFromResponse, AUDIUS_API, AudiusSessionClient, AudiusSessionError, sessionWithTokens, type AudiusAccount, type TokenResponse } from '@/services/audius-session-core';

// This public key identifies Crimson during OAuth. Never use an app bearer secret.
const CLIENT_ID = process.env.EXPO_PUBLIC_AUDIUS_API_KEY || null;
const SCOPE = 'write';
const SESSION_KEY = 'crimson.audius.session.v1';
const client = new AudiusSessionClient({
  async read() {
    if (Platform.OS === 'web') return typeof window !== 'undefined' ? window.sessionStorage.getItem(SESSION_KEY) : null;
    return SecureStore.getItemAsync(SESSION_KEY);
  },
  async write(value) {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        if (value) window.sessionStorage.setItem(SESSION_KEY, value);
        else window.sessionStorage.removeItem(SESSION_KEY);
      }
      return;
    }
    // Background playback can rotate tokens while the phone is locked after its first unlock.
    if (value) await SecureStore.setItemAsync(SESSION_KEY, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  },
});

export { AudiusSessionError };
export const getCurrentAudiusUserId = () => client.current()?.account.id || null;
export const getAudiusSession = () => client.current();
export const subscribeAudiusSession = (listener: () => void) => client.subscribe(listener);
export const restoreAudiusSession = () => client.restore();
export const logoutAudius = () => client.logout();
export const canWriteAudius = () => client.current()?.scope === 'write';
export const audiusFetch = (path: string, init?: RequestInit) => client.request(path, init);
export function audiusRedirectUri() {
  return Platform.OS === 'web' ? makeRedirectUri({ path: 'oauth/callback' }) : 'crimsonmusic://oauth/callback';
}

export async function audiusRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const response = await audiusFetch(path, {
    method: options.method || 'GET',
    ...(options.body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body) } : {}),
  });
  if (!response.ok) {
    const message = response.status === 403 ? 'Audius did not permit this action. Check your account permissions.' : response.status === 429 ? 'Audius is receiving too many requests. Please try again shortly.' : `Audius request failed (${response.status}). Please try again.`;
    throw new AudiusSessionError(message, String(response.status));
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

async function resolveAccount(payload: unknown, token: string): Promise<AudiusAccount> {
  try { return accountFromResponse(payload); }
  catch {
    // Earlier /me responses expose a numeric userId instead of the REST hashid.
    const root = payload as { data?: { handle?: string }; handle?: string };
    const handle = root?.data?.handle || root?.handle;
    if (!handle) throw new AudiusSessionError('Audius returned an incomplete account profile.');
    const response = await client.raw(`/users/handle/${encodeURIComponent(handle)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new AudiusSessionError('Could not load your Audius profile.');
    return accountFromResponse(await response.json());
  }
}

let loginPending: Promise<AudiusAccount> | null = null;
export function loginAudius() {
  if (loginPending) return loginPending;
  const operation = (async () => {
    if (!CLIENT_ID) throw new AudiusSessionError('Audius login is not configured for this build of Crimson.');
    const revision = client.version();
    const redirectUri = audiusRedirectUri();
    const request = new AuthRequest({
      clientId: CLIENT_ID, redirectUri, responseType: ResponseType.Code,
      scopes: [SCOPE], usePKCE: true,
      extraParams: { api_key: CLIENT_ID, response_mode: 'query', display: Platform.OS === 'web' ? 'popup' : 'fullScreen' },
    });
    const discovery = { authorizationEndpoint: `${AUDIUS_API}/oauth/authorize` };
    const url = new URL(await request.makeAuthUrlAsync(discovery));
    // Audius uses api_key at authorization, not the standard client_id parameter.
    url.searchParams.delete('client_id');
    const result = await request.promptAsync(discovery, { url: url.toString() });
    if (result.type === 'cancel' || result.type === 'dismiss' || (result.type === 'error' && result.params?.error === 'access_denied')) throw new AudiusSessionError('Login was cancelled.', 'cancelled');
    if (result.type !== 'success' || !result.params.code || result.params.state !== request.state || !request.codeVerifier) throw new AudiusSessionError('Audius login could not be verified. Please try again.');
    const tokenResponse = await client.raw('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code: result.params.code, code_verifier: request.codeVerifier, client_id: CLIENT_ID, redirect_uri: redirectUri }) });
    if (!tokenResponse.ok) throw new AudiusSessionError('Audius could not complete login. Check Crimson’s registered callback and try again.');
    const tokens = await tokenResponse.json() as TokenResponse;
    if (!tokens.access_token || !tokens.refresh_token) throw new AudiusSessionError('Audius returned an incomplete login session.');
    const response = await client.raw('/me', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!response.ok) throw new AudiusSessionError('Could not load your Audius account. Please try logging in again.');
    const account = await resolveAccount(await response.json(), tokens.access_token);
    await client.establish(sessionWithTokens(tokens, { clientId: CLIENT_ID, scope: SCOPE, account }), revision);
    return account;
  })();
  loginPending = operation;
  void operation.finally(() => { if (loginPending === operation) loginPending = null; }).catch(() => undefined);
  return operation;
}

export async function refreshAudiusAccount() {
  const revision = client.version();
  const payload = await audiusRequest<unknown>('/me');
  const account = await resolveAccount(payload, await client.accessToken());
  return client.updateAccount(account, revision);
}

/** Never send account tokens to an artwork mirror, CDN, or a third-party URL. */
export async function audiusMediaHeaders(url: string): Promise<Record<string, string> | undefined> {
  const target = new URL(url);
  if (target.origin !== new URL(AUDIUS_API).origin || !target.pathname.startsWith('/v1/tracks/')) return undefined;
  return { Authorization: `Bearer ${await client.accessToken()}` };
}
