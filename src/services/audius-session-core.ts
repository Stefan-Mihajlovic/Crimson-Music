/** Audius OAuth session lifecycle. No app-wide API credential is sent with music requests. */
export const AUDIUS_API = 'https://api.audius.co/v1';

export type AudiusAccount = { id: string; handle: string; name: string; picture: string };
export type AudiusSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  refreshExpiresAt: number | null;
  clientId: string | null;
  scope: 'read' | 'write';
  account: AudiusAccount;
};
export type TokenResponse = {
  access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number;
};
export type SessionStorage = { read(): Promise<string | null>; write(value: string | null): Promise<void> };

export class AudiusSessionError extends Error {
  readonly code: string;
  constructor(message: string, code = 'session') { super(message); this.name = 'AudiusSessionError'; this.code = code; }
}

export function accountFromResponse(payload: unknown): AudiusAccount {
  const root = payload as Record<string, unknown> | null;
  const value = (root?.data || root) as Record<string, unknown> | null;
  // /me returns a full user with an encoded id. Resolve older numeric userId payloads by handle separately.
  if (!value || typeof value.id !== 'string' || !value.id || typeof value.handle !== 'string' || !value.handle) {
    throw new AudiusSessionError('Audius returned an incomplete account profile.');
  }
  const pictures = (value.profile_picture || value.profilePicture || {}) as Record<string, string>;
  return { id: value.id, handle: value.handle, name: String(value.name || value.handle), picture: pictures['1000x1000'] || pictures['480x480'] || pictures['150x150'] || '' };
}

function tokenExpiry(seconds?: number) {
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Date.now() + seconds * 1000 : null;
}

export function sessionWithTokens(tokens: TokenResponse, session: Omit<AudiusSession, 'accessToken' | 'refreshToken' | 'expiresAt' | 'refreshExpiresAt'>): AudiusSession {
  if (!tokens.access_token || !tokens.refresh_token) throw new AudiusSessionError('Audius did not return a valid login session.');
  return { ...session, accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: tokenExpiry(tokens.expires_in), refreshExpiresAt: tokenExpiry(tokens.refresh_expires_in) };
}

export class AudiusSessionClient {
  private session: AudiusSession | null = null;
  private revision = 0;
  private refreshPending: Promise<AudiusSession> | null = null;
  private persistence: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private storage: SessionStorage;
  private transport: typeof fetch;

  constructor(storage: SessionStorage, transport: typeof fetch = fetch) { this.storage = storage; this.transport = transport; }
  current() { return this.session; }
  version() { return this.revision; }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify() { this.listeners.forEach((listener) => listener()); }
  private persist() {
    const value = this.session ? JSON.stringify(this.session) : null;
    this.persistence = this.persistence.catch(() => undefined).then(() => this.storage.write(value));
    return this.persistence;
  }
  async restore() {
    if (this.session) return this.session;
    const revision = this.revision;
    const raw = await this.storage.read();
    if (revision !== this.revision || this.session || !raw) return this.session;
    try {
      const saved = JSON.parse(raw) as AudiusSession;
      if (!saved.accessToken || !saved.refreshToken || !saved.account?.id || !saved.account?.handle || !['read', 'write'].includes(saved.scope)) throw new Error('Invalid session');
      if (saved.refreshExpiresAt && saved.refreshExpiresAt <= Date.now()) throw new Error('Expired session');
      this.session = saved;
      this.notify();
    } catch { await this.clear(); }
    return this.session;
  }
  async establish(session: AudiusSession, expectedRevision: number) {
    if (this.revision !== expectedRevision) throw new AudiusSessionError('Login was cancelled.', 'cancelled');
    this.revision += 1;
    this.session = session;
    try { await this.persist(); }
    catch { this.session = null; this.revision += 1; this.notify(); throw new AudiusSessionError('Could not securely save your Audius session. Please try again.'); }
    this.notify();
    return session;
  }
  async updateAccount(account: AudiusAccount, expectedRevision: number) {
    if (this.revision !== expectedRevision || this.session?.account.id !== account.id) {
      throw new AudiusSessionError('The Audius account changed. Please try again.', 'cancelled');
    }
    this.session = { ...this.session, account };
    await this.persist();
    return account;
  }
  async clear() {
    this.revision += 1;
    this.session = null;
    this.refreshPending = null;
    this.notify();
    await this.persist();
  }
  async raw(path: string, init: RequestInit = {}) {
    if (!path.startsWith('/') || path.startsWith('//')) throw new AudiusSessionError('Invalid Audius request path.');
    const url = new URL(`${AUDIUS_API}${path}`);
    if (url.origin !== new URL(AUDIUS_API).origin || !url.pathname.startsWith('/v1/')) throw new AudiusSessionError('Invalid Audius request destination.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    init.signal?.addEventListener('abort', abort, { once: true });
    if (init.signal?.aborted) abort();
    const timeout = setTimeout(abort, 12_000);
    try { return await this.transport(url.toString(), { ...init, signal: controller.signal }); }
    finally { clearTimeout(timeout); init.signal?.removeEventListener('abort', abort); }
  }
  private async refresh() {
    if (this.refreshPending) return this.refreshPending;
    const previous = this.session;
    const revision = this.revision;
    if (!previous) throw new AudiusSessionError('Login with Audius to continue.', 'unauthenticated');
    const pending = (async () => {
      const response = await this.raw('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: previous.refreshToken, client_id: previous.clientId }) });
      if (!response.ok) {
        if ([400, 401, 403].includes(response.status) && revision === this.revision) await this.clear();
        throw new AudiusSessionError(response.status >= 500 ? 'Audius is temporarily unavailable. Try again shortly.' : 'Your Audius session expired. Please log in again.', response.status >= 500 ? 'network' : 'unauthenticated');
      }
      const updated = sessionWithTokens(await response.json(), previous);
      if (revision !== this.revision) throw new AudiusSessionError('The Audius account changed. Please try again.', 'cancelled');
      this.session = updated;
      await this.persist();
      return updated;
    })();
    this.refreshPending = pending;
    try { return await pending; } finally { if (this.refreshPending === pending) this.refreshPending = null; }
  }
  async accessToken() {
    if (!this.session) throw new AudiusSessionError('Login with Audius to continue.', 'unauthenticated');
    if (this.session.refreshExpiresAt && this.session.refreshExpiresAt <= Date.now()) { await this.clear(); throw new AudiusSessionError('Your Audius session expired. Please log in again.', 'unauthenticated'); }
    if (this.session.expiresAt && this.session.expiresAt <= Date.now() + 30_000) await this.refresh();
    if (!this.session) throw new AudiusSessionError('Login with Audius to continue.', 'unauthenticated');
    return this.session.accessToken;
  }
  async request(path: string, init: RequestInit = {}) {
    if (!['GET', 'HEAD'].includes((init.method || 'GET').toUpperCase()) && this.session?.scope !== 'write') {
      throw new AudiusSessionError('This login is read-only. Make library changes in Audius.', 'read_only');
    }
    const revision = this.revision;
    const token = await this.accessToken();
    if (revision !== this.revision || !this.session) throw new AudiusSessionError('The Audius account changed. Please try again.', 'cancelled');
    // Explicit identity makes Audius reject expired tokens instead of falling back to anonymous reads.
    const queryAt = path.indexOf('?');
    const params = new URLSearchParams(queryAt >= 0 ? path.slice(queryAt + 1) : '');
    params.set('user_id', this.session.account.id);
    const authenticatedPath = `${queryAt >= 0 ? path.slice(0, queryAt) : path}?${params}`;
    const send = (value: string) => this.raw(authenticatedPath, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers).entries()), Authorization: `Bearer ${value}` } });
    let response = await send(token);
    if (revision !== this.revision) throw new AudiusSessionError('The Audius account changed. Please try again.', 'cancelled');
    if (response.status === 401) {
      await response.body?.cancel();
      // Other requests may already have refreshed this token.
      const session = this.session?.accessToken !== token ? this.session : await this.refresh();
      if (!session || revision !== this.revision) throw new AudiusSessionError('Login with Audius to continue.', 'unauthenticated');
      response = await send(session.accessToken);
      if (revision !== this.revision) throw new AudiusSessionError('The Audius account changed. Please try again.', 'cancelled');
      if (response.status === 401) { await this.clear(); throw new AudiusSessionError('Your Audius session expired. Please log in again.', 'unauthenticated'); }
    }
    return response;
  }
  async logout() {
    const session = this.session;
    await this.clear();
    if (session) {
      await this.raw('/oauth/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: session.refreshToken, client_id: session.clientId }) }).catch(() => undefined);
    }
  }
}
