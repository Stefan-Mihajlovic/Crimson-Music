import { Platform } from 'react-native';
import { File as NativeFile } from 'expo-file-system';
import { clearAudiusCaches } from '@/services/audius';
import { isAccountDeleted, registerAccountCleanup } from '@/services/account-lifecycle';
import { audiusRequest, AudiusSessionError, commitAudiusProfile, getAudiusSession, getAudiusSessionRevision } from '@/services/audius-session';

export type ProfilePhotoUpload = { uri: string; name: string; type: string; file?: File; size?: number };
export type ProfileUpdate = { name: string; photo?: ProfilePhotoUpload };
export const PROFILE_NAME_MAX_LENGTH = 32;
export const PROFILE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

type Upload = { id?: string; status?: string; orig_file_cid?: string; error?: string };
type StorageHealth = { data?: { diskHasSpace?: boolean; transcodeStats?: { AvgTranscodeTime?: number }; network?: { content_nodes?: { endpoint?: string }[] } } };
const storageFallbacks = ['https://creatornode.audius.co', 'https://creatornode2.audius.co', 'https://creatornode3.audius.co'];
const pendingSaves = new Map<string, Promise<Awaited<ReturnType<typeof commitAudiusProfile>>>>();
registerAccountCleanup(async (uid) => { await pendingSaves.get(uid)?.catch(() => undefined); });

class StorageRequestError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

async function storageJson<T>(url: string, init: RequestInit = {}, timeout = 12_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let responseReceived = false;
  try {
    // Image storage is public and deliberately unauthenticated. Never attach
    // the listener's OAuth token to a storage node or its redirect target.
    const response = await fetch(url, { ...init, signal: controller.signal, credentials: 'omit' });
    responseReceived = true;
    if (!response.ok) throw new StorageRequestError('Audius could not process this photo. Please try another image or retry shortly.', response.status >= 500);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof StorageRequestError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new StorageRequestError('The photo upload took too long. Check your connection and try again.', true);
    }
    if (!responseReceived) throw new StorageRequestError('Could not reach Audius photo storage. Check your connection and try again.', true);
    throw error;
  } finally { clearTimeout(timer); }
}

function storageOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) return null;
    if (!url.hostname.includes('.') || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

async function chooseStorage(assertCurrent: () => void) {
  const discovered = await storageJson<StorageHealth>('https://api.audius.co/health_check', {}, 6000).catch(() => null);
  assertCurrent();
  const candidates = [...new Set([
    ...(discovered?.data?.network?.content_nodes || []).map((node) => node.endpoint || ''),
    ...storageFallbacks,
  ].map(storageOrigin).filter((origin): origin is string => !!origin))];
  for (const origin of candidates.slice(0, 5)) {
    assertCurrent();
    const health = await storageJson<StorageHealth>(`${origin}/health_check`, {}, 5000).catch(() => null);
    assertCurrent();
    if (health?.data?.diskHasSpace && (health.data.transcodeStats?.AvgTranscodeTime ?? 0) <= 180) return origin;
  }
  throw new Error('Audius photo storage is unavailable. Your profile has not changed. Please try again shortly.');
}

function validatePhoto(photo: ProfilePhotoUpload) {
  const size = photo.file?.size ?? photo.size;
  if (size !== undefined && (!Number.isFinite(size) || size <= 0 || size > PROFILE_PHOTO_MAX_BYTES)) {
    throw new Error('Choose a photo smaller than 10 MB.');
  }
  if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(photo.type)) {
    throw new Error('Choose a JPEG, PNG, WebP, GIF, or HEIC photo.');
  }
  if (Platform.OS === 'web' ? !photo.file && !/^(blob:|data:image\/)/.test(photo.uri) : !/^(file|content):\/\//.test(photo.uri)) {
    throw new Error('Choose a photo from your photo library again.');
  }
}

async function uploadPhoto(photo: ProfilePhotoUpload, assertCurrent: () => void) {
  validatePhoto(photo);
  const form = new FormData();
  form.append('template', 'img_square');
  if (Platform.OS === 'web') {
    const file = photo.file ?? await (await fetch(photo.uri)).blob();
    if (!file.size || file.size > PROFILE_PHOTO_MAX_BYTES) throw new Error('Choose a photo smaller than 10 MB.');
    form.append('files', file, photo.name);
  } else {
    // Expo 57's fetch serializes Blob/File bytes, not React Native's legacy
    // { uri, name, type } parts. A URI tuple fails before a request is sent.
    let file: NativeFile;
    let size: number;
    try {
      file = new NativeFile(photo.uri);
      if (!file.exists) throw new Error('missing');
      size = file.size;
    } catch {
      throw new Error('This photo is no longer available. Please choose it again.');
    }
    if (!Number.isFinite(size) || size <= 0 || size > PROFILE_PHOTO_MAX_BYTES) throw new Error('Choose a photo smaller than 10 MB.');
    form.append('files', file);
  }
  assertCurrent();
  const origin = await chooseStorage(assertCurrent);
  const uploads = await storageJson<Upload[]>(`${origin}/uploads`, { method: 'POST', body: form }, 90_000);
  assertCurrent();
  let upload = Array.isArray(uploads) ? uploads[0] : undefined;
  const uploadId = upload?.id;
  const deadline = Date.now() + 120_000;
  let consecutivePollFailures = 0;
  while (upload && upload.status !== 'done' && !['error', 'failed', 'timeout'].includes(upload.status || '')) {
    if (!uploadId || !/^[a-zA-Z0-9_-]+$/.test(uploadId) || Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(3000, deadline - Date.now())));
    assertCurrent();
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      upload = await storageJson<Upload>(`${origin}/uploads/${encodeURIComponent(uploadId)}`, {}, Math.min(12_000, remaining));
      consecutivePollFailures = 0;
    } catch (error) {
      assertCurrent();
      if (!(error instanceof StorageRequestError) || !error.retryable || ++consecutivePollFailures >= 3) throw error;
      // Resume polling this upload, rather than resending an already stored photo.
    }
    assertCurrent();
  }
  if (upload?.status === 'timeout') throw new Error('Audius photo processing timed out. Please try again.');
  if (upload?.status !== 'done' || !upload.orig_file_cid || !/^[a-zA-Z0-9]+$/.test(upload.orig_file_cid)) {
    throw new Error('Audius could not finish processing this photo. Please try again.');
  }
  return { cid: upload.orig_file_cid, picture: `${origin}/content/${encodeURIComponent(upload.orig_file_cid)}/480x480.jpg` };
}

export function updateAudiusProfile(uid: string, update: ProfileUpdate) {
  if (pendingSaves.has(uid)) return Promise.reject(new Error('Your profile is already being saved.'));
  const revision = getAudiusSessionRevision();
  const assertCurrent = () => {
    const session = getAudiusSession();
    if (!session || session.account.id !== uid || getAudiusSessionRevision() !== revision || isAccountDeleted(uid)) {
      throw new AudiusSessionError('The Audius account changed. Please reopen Edit profile.', 'cancelled');
    }
    if (session.scope !== 'write') throw new AudiusSessionError('Reconnect Audius to edit your profile.', 'read_only');
  };
  const operation = (async () => {
    assertCurrent();
    const current = getAudiusSession()!.account;
    const name = update.name.trim();
    if (!name || (name !== current.name && name.length > PROFILE_NAME_MAX_LENGTH) || /[\r\n\u0000-\u001f]/.test(name)) {
      throw new Error(`Enter a display name of 1–${PROFILE_NAME_MAX_LENGTH} characters.`);
    }
    if (name === current.name && !update.photo) return current;
    const uploaded = update.photo ? await uploadPhoto(update.photo, assertCurrent) : undefined;
    assertCurrent();
    // Send only edited fields; preserve bio, cover image, links, and handle.
    const response = await audiusRequest<{ transaction_hash?: string; success?: boolean }>(`/users/${encodeURIComponent(uid)}`, {
      method: 'PUT',
      body: {
        ...(name !== current.name ? { name } : {}),
        ...(uploaded ? { profile_picture: uploaded.cid, profile_picture_sizes: uploaded.cid } : {}),
      },
    });
    assertCurrent();
    if (response?.success === false || (!response?.transaction_hash && response?.success !== true)) {
      throw new Error('Audius did not confirm the profile update. Please try again.');
    }
    const account = await commitAudiusProfile(uid, {
      ...(name !== current.name ? { name } : {}),
      ...(uploaded ? { picture: uploaded.picture } : {}),
    }, revision);
    assertCurrent();
    clearAudiusCaches();
    return account;
  })();
  pendingSaves.set(uid, operation);
  void operation.finally(() => { if (pendingSaves.get(uid) === operation) pendingSaves.delete(uid); }).catch(() => undefined);
  return operation;
}
