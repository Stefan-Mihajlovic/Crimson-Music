import { RequestCache } from '@/services/request-cache';
import { AuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { accountFromResponse, AUDIUS_API, AudiusSessionClient, AudiusSessionError, sessionWithTokens, type AudiusAccount, type TokenResponse } from '@/services/audius-session-core';

// This public key identifies Crimson during OAuth. Never use an app bearer secret.
const CLIENT_ID = process.env.EXPO_PUBLIC_AUDIUS_API_KEY?.trim() || null;
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
export const getAudiusSessionRevision = () => client.version();
export const subscribeAudiusSession = (listener: () => void) => client.subscribe(listener);
export const restoreAudiusSession = () => client.restore();
export const logoutAudius = async () => { try { await savePending(null); } finally { await client.logout(); } };
export const canWriteAudius = () => client.current()?.scope === 'write';
export const audiusFetch = (path: string, init?: RequestInit) => client.request(path, init);
export function audiusRedirectUri() {
  return Platform.OS === 'web' ? makeRedirectUri({ path: 'oauth/callback' }) : 'crimsonmusic://oauth/callback';
}

const reads = new RequestCache();
export function audiusRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  // Coalesce only concurrent GETs; retain no stale library data after mutations.
  if ((options.method || 'GET').toUpperCase() === 'GET' && options.body === undefined) {
    return reads.get(`${client.version()}:${path}`, () => performAudiusRequest<T>(path, options));
  }
  reads.clear();
  return performAudiusRequest<T>(path, options);
}
async function performAudiusRequest<T>(path: string, options: { method?: string; body?: unknown }): Promise<T> {
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

const PENDING_KEY = 'crimson.audius.pending.v1';
type PendingLogin = { state: string; verifier: string; redirectUri: string; createdAt: number };
async function savePending(value: PendingLogin | null) {
  if (Platform.OS === 'web') {
    if (value) window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(PENDING_KEY);
  } else if (value) await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(value));
  else await SecureStore.deleteItemAsync(PENDING_KEY);
}
async function readPending(): Promise<PendingLogin | null> {
  const raw = Platform.OS === 'web' ? window.sessionStorage.getItem(PENDING_KEY) : await SecureStore.getItemAsync(PENDING_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as PendingLogin; } catch { return null; }
}

const completing = new Map<string, Promise<AudiusAccount>>();
/** Shared by the live native browser session and recovery after an OS restart. */
export function completeAudiusLogin(url: string, expectedRevision = client.version()): Promise<AudiusAccount> {
  const existing = completing.get(url);
  if (existing) return existing;
  const operation = (async () => {
    const pending = await readPending();
    const callback = new URL(url);
    const params = new URLSearchParams(callback.search || callback.hash.slice(1));
    if (!CLIENT_ID || !pending || !Number.isFinite(pending.createdAt) ||
      Date.now() - pending.createdAt > 10 * 60_000 || pending.createdAt > Date.now() + 60_000 ||
      typeof pending.verifier !== 'string' || !pending.verifier || params.get('state') !== pending.state ||
      `${callback.protocol}//${callback.host}${callback.pathname}` !== pending.redirectUri) {
      throw new AudiusSessionError('Audius login could not be verified. Please try again.');
    }
    if (params.get('error') === 'access_denied') {
      await savePending(null);
      throw new AudiusSessionError('Login was cancelled.', 'cancelled');
    }
    const code = params.get('code');
    if (!code) throw new AudiusSessionError('Audius login could not be verified. Please try again.');
    const revision = expectedRevision;
    // Consume before exchange: an authorization code must never be submitted twice.
    await savePending(null);
    const tokenResponse = await client.raw('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code, code_verifier: pending.verifier, client_id: CLIENT_ID, redirect_uri: pending.redirectUri }) });
    if (!tokenResponse.ok) throw new AudiusSessionError('Audius could not complete login. Check Crimson’s registered callback and try again.');
    const tokens = await tokenResponse.json() as TokenResponse;
    if (!tokens.access_token || !tokens.refresh_token) throw new AudiusSessionError('Audius returned an incomplete login session.');
    // GET is safe to retry after a transient connection/server failure; token exchanges are not.
    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await client.raw('/me', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
        if (response.status < 500 || attempt === 1) break;
        await response.body?.cancel();
      } catch (error) { if (attempt === 1) throw error; }
    }
    if (!response?.ok) throw new AudiusSessionError('Could not load your Audius account. Please try logging in again.');
    const account = await resolveAccount(await response.json(), tokens.access_token);
    await client.establish(sessionWithTokens(tokens, { clientId: CLIENT_ID, scope: SCOPE, account }), revision);
    return account;
  })();
  completing.set(url, operation);
  void operation.finally(() => { if (completing.get(url) === operation) completing.delete(url); }).catch(() => undefined);
  return operation;
}

let loginPending: Promise<AudiusAccount> | null = null;
export const isAudiusLoginPending = () => Boolean(loginPending);
export function loginAudius() {
  if (loginPending) return loginPending;
  const operation = (async () => {
    if (!CLIENT_ID) throw new AudiusSessionError('Audius login is not configured for this build of Crimson.');
    const revision = client.version();
    const redirectUri = audiusRedirectUri();
    const request = new AuthRequest({
      clientId: CLIENT_ID, redirectUri, responseType: ResponseType.Code,
      scopes: [SCOPE], usePKCE: true,
      extraParams: { api_key: CLIENT_ID, response_mode: 'query', display: 'fullScreen' },
    });
    const discovery = { authorizationEndpoint: `${AUDIUS_API}/oauth/authorize` };
    const url = new URL(await request.makeAuthUrlAsync(discovery));
    url.searchParams.delete('client_id');
    if (!request.codeVerifier) throw new AudiusSessionError('Could not prepare a secure Audius login.');
    await savePending({ state: request.state, verifier: request.codeVerifier, redirectUri, createdAt: Date.now() });
    if (Platform.OS === 'web') {
      // Same-tab redirect avoids popup blocking and lost window.opener references.
      return new Promise<AudiusAccount>((_, reject) => {
        // Back from Audius can restore this exact document from the back/forward
        // cache. Release its busy state instead of retaining a never-ending login.
        const returned = () => {
          void savePending(null).catch(() => undefined).then(() => reject(new AudiusSessionError('Login was cancelled.', 'cancelled')));
        };
        window.addEventListener('pageshow', returned, { once: true });
        try { window.location.assign(url.toString()); }
        catch (error) { window.removeEventListener('pageshow', returned); reject(error); }
      });
    }
    try {
      const result = await request.promptAsync(discovery, { url: url.toString() });
      if (result.type === 'cancel' || result.type === 'dismiss' || (result.type === 'error' && result.params?.error === 'access_denied')) throw new AudiusSessionError('Login was cancelled.', 'cancelled');
      if (result.type !== 'success' || !result.params.code || result.params.state !== request.state) throw new AudiusSessionError('Audius login could not be verified. Please try again.');
      return await completeAudiusLogin(`${redirectUri}?${new URLSearchParams(result.params)}`, revision);
    } finally { await savePending(null); }
  })();
  loginPending = operation;
  void operation.finally(() => { if (loginPending === operation) loginPending = null; }).catch(() => undefined);
  return operation;
}

export async function refreshAudiusAccount() {
  const revision = client.version();
  const previousAccount = client.current()?.account;
  const payload = await audiusRequest<unknown>('/me');
  const account = await resolveAccount(payload, await client.accessToken());
  return client.updateAccount(account, revision, previousAccount);
}

/** Apply only fields that Audius has accepted, preserving other account data. */
export async function commitAudiusProfile(uid: string, patch: Partial<Pick<AudiusAccount, 'name' | 'picture'>>, revision: number) {
  const account = client.current()?.account;
  if (!account || account.id !== uid || client.version() !== revision) {
    throw new AudiusSessionError('The Audius account changed. Please try again.', 'cancelled');
  }
  return client.updateAccount({ ...account, ...patch }, revision);
}

/** Never send account tokens to an artwork mirror, CDN, or a third-party URL. */
export async function audiusMediaHeaders(url: string): Promise<Record<string, string> | undefined> {
  const target = new URL(url);
  if (target.origin !== new URL(AUDIUS_API).origin || !target.pathname.startsWith('/v1/tracks/')) return undefined;
  return { Authorization: `Bearer ${await client.accessToken()}` };
}
