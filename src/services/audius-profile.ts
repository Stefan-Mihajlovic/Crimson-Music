import { uploadAudiusImage, type ProfilePhotoUpload } from '@/services/audius-image-upload';
import { clearAudiusCaches } from '@/services/audius';
import { isAccountDeleted, registerAccountCleanup } from '@/services/account-lifecycle';
import { audiusRequest, AudiusSessionError, commitAudiusProfile, getAudiusSession, getAudiusSessionRevision } from '@/services/audius-session';
export { PROFILE_PHOTO_MAX_BYTES } from '@/services/audius-image-upload';
export type { ProfilePhotoUpload } from '@/services/audius-image-upload';

export type ProfileUpdate = { name: string; photo?: ProfilePhotoUpload };
export const PROFILE_NAME_MAX_LENGTH = 32;

const pendingSaves = new Map<string, Promise<Awaited<ReturnType<typeof commitAudiusProfile>>>>();
registerAccountCleanup(async (uid) => { await pendingSaves.get(uid)?.catch(() => undefined); });

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
    const uploaded = update.photo ? await uploadAudiusImage(update.photo, assertCurrent) : undefined;
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
