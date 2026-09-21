import { isAccountDeleted, registerAccountCleanup } from '@/services/account-lifecycle';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CrimsonSong } from '@/types/music';
import { listImportedAudio, pickLocalAudio, removeImportedAudio, resolveLocalAudioUri, scanDeviceAudio } from '@/services/local-music-platform';
import { isLocalTrackId, localAudioSong, mergeLocalMusic } from '@/services/local-music-model';
export { isLocalTrackId, LOCAL_MUSIC_ID } from '@/services/local-music-model';

const STORAGE_KEY = 'crimson.local-music.v1';
const pageKey = (revision: string, page: number) => `${STORAGE_KEY}:${revision}:${page}`;
type StoredIndex = { pages: number; revision: string };
async function storedSongs(): Promise<CrimsonSong[]> {
  const value = JSON.parse(await AsyncStorage.getItem(STORAGE_KEY) || '[]') as CrimsonSong[] | StoredIndex;
  if (Array.isArray(value)) return value;
  if (!value || !Number.isInteger(value.pages) || value.pages < 0 || typeof value.revision !== 'string') throw new Error('Local Music could not be read. Import your files or scan again.');
  const chunks = await AsyncStorage.multiGet(Array.from({ length: value.pages }, (_, page) => pageKey(value.revision, page)));
  return chunks.flatMap(([, chunk]) => {
    if (!chunk) throw new Error('Local Music storage is incomplete. Import your files or scan again.');
    return JSON.parse(chunk) as CrimsonSong[];
  });
}
async function persistSongs(songs: CrimsonSong[]) {
  // Bound every SQLite value well below Android CursorWindow's per-row limit.
  const previous = JSON.parse(await AsyncStorage.getItem(STORAGE_KEY) || '[]') as CrimsonSong[] | StoredIndex;
  const revision = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const pages = Math.ceil(songs.length / 150);
  const entries: [string, string][] = Array.from({ length: pages }, (_, page) => [pageKey(revision, page), JSON.stringify(songs.slice(page * 150, (page + 1) * 150))]);
  if (entries.length) await AsyncStorage.multiSet(entries);
  // Commit the new index only after all pages are durable.
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ revision, pages }));
  if (!Array.isArray(previous) && previous?.revision && Number.isInteger(previous.pages)) {
    await AsyncStorage.multiRemove(Array.from({ length: previous.pages }, (_, page) => pageKey(previous.revision, page))).catch(() => undefined);
  }
}
let writes: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
export function subscribeLocalMusic(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export async function readLocalMusic(): Promise<CrimsonSong[]> {
  await writes.catch(() => undefined);
  const value: unknown = await storedSongs();
  return Array.isArray(value) ? value.filter((song): song is CrimsonSong => Boolean(song && song.source === 'local' && isLocalTrackId(song.id) && typeof song.url === 'string')) : [];
}
function update(action: (current: CrimsonSong[]) => Promise<CrimsonSong[]>) {
  const pending = writes.catch(() => undefined).then(async () => {
    const current = await storedSongs();
    const next = await action(Array.isArray(current) ? current : []);
    await persistSongs(next);
    listeners.forEach((listener) => listener());
    return next;
  });
  writes = pending;
  return pending;
}
export async function refreshImportedMusic() {
  const files = await listImportedAudio();
  return update(async (current) => mergeLocalMusic(current.filter((song) => song.local?.kind !== 'import'), files.map(localAudioSong)));
}
export async function scanLocalMusic() {
  const result = await scanDeviceAudio();
  const songs = await update(async (current) => mergeLocalMusic(current, result.files.map(localAudioSong), true));
  return { songs, added: result.files.length, skipped: result.skipped };
}
export async function importLocalMusic(folder = false) {
  // Preserve the user activation for browser file pickers before any storage reads.
  const result = await pickLocalAudio(folder);
  const songs = await update(async (current) => mergeLocalMusic(current, result.files.map(localAudioSong)));
  return { songs, added: result.files.length, skipped: result.skipped };
}
export async function removeLocalMusic(song: CrimsonSong) {
  if (song.local?.kind !== 'import') throw new Error('Remove this file using your device’s Files app, then scan again.');
  await removeImportedAudio(song);
  return update(async (current) => current.filter((item) => item.id !== song.id));
}
export async function getLocalSong(id: string) {
  const song = (await readLocalMusic()).find((item) => item.id === id);
  if (!song) throw new Error('This local file is no longer in your library. Import it or scan again.');
  return song;
}
export async function resolveLocalPlaybackUrl(song: Pick<CrimsonSong, 'id' | 'url'>) {
  const current = await getLocalSong(song.id);
  return resolveLocalAudioUri(current);
}
const favoriteWrites = new Map<string, Promise<void>>();
const favoritesKey = (uid: string) => `crimson.local-favorites.v1:${uid}`;
async function storedFavoriteIds(uid: string): Promise<string[]> {
  const parsed: unknown = JSON.parse(await AsyncStorage.getItem(favoritesKey(uid)) || '[]');
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && isLocalTrackId(id)) : [];
}
export async function readLocalFavoriteIds(uid: string): Promise<string[]> {
  await favoriteWrites.get(uid)?.catch(() => undefined);
  return storedFavoriteIds(uid);
}
export async function setLocalFavorite(uid: string, id: string, included: boolean) {
  const pending = (favoriteWrites.get(uid) || Promise.resolve()).catch(() => undefined).then(async () => {
    if (isAccountDeleted(uid)) throw new Error('This account has been disconnected. Sign in again to save favorites.');
    const ids = await storedFavoriteIds(uid);
    if (isAccountDeleted(uid)) throw new Error('This account has been disconnected. Sign in again to save favorites.');
    await AsyncStorage.setItem(favoritesKey(uid), JSON.stringify(included ? [...new Set([...ids, id])] : ids.filter((item) => item !== id)));
  });
  favoriteWrites.set(uid, pending);
  try { await pending; } finally { if (favoriteWrites.get(uid) === pending) favoriteWrites.delete(uid); }
}
export async function readLocalFavorites(uid: string) {
  const [ids, songs] = await Promise.all([readLocalFavoriteIds(uid), readLocalMusic()]);
  return ids.flatMap((id) => songs.filter((song) => song.id === id));
}

registerAccountCleanup(async (uid) => {
  await favoriteWrites.get(uid)?.catch(() => undefined);
  await AsyncStorage.removeItem(favoritesKey(uid));
});
