import { isAccountDeleted, registerAccountCleanup } from '@/services/account-lifecycle';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readLocalMusic, isLocalTrackId } from '@/services/local-music';
import type { CrimsonPlaylist, CrimsonSong } from '@/types/music';

const key = (uid: string, id: string) => `crimson.playlist-local-tracks.v1:${uid}:${id}`;
const writes = new Map<string, Promise<void>>();
registerAccountCleanup(async (uid) => {
  await writes.get(uid)?.catch(() => undefined);
  const keys = (await AsyncStorage.getAllKeys()).filter((value) => value.startsWith(`crimson.playlist-local-tracks.v1:${uid}:`));
  if (keys.length) await AsyncStorage.multiRemove(keys);
});
// Store a merged order so local tracks can be moved between streamed tracks.
export async function readPlaylistOrder(uid: string, id: string): Promise<string[]> {
  const value: unknown = JSON.parse(await AsyncStorage.getItem(key(uid, id)) || '[]');
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : [];
}
export async function savePlaylistOrder(uid: string, id: string, ids: string[]) {
  const pending = (writes.get(uid) || Promise.resolve()).catch(() => undefined).then(async () => {
    if (isAccountDeleted(uid)) throw new Error('This account has been disconnected.');
    await AsyncStorage.setItem(key(uid, id), JSON.stringify([...new Set(ids)]));
  });
  writes.set(uid, pending);
  try { await pending; } finally { if (writes.get(uid) === pending) writes.delete(uid); }
}
export async function removePlaylistOrder(uid: string, id: string) {
  await AsyncStorage.removeItem(key(uid, id));
}
export async function withLocalPlaylistTracks(playlist: CrimsonPlaylist, uid?: string): Promise<CrimsonPlaylist> {
  if (!uid || !playlist.owned) return playlist;
  const order = await readPlaylistOrder(uid, playlist.id);
  const remote = playlist.songs.filter((id) => !isLocalTrackId(id));
  const localIds = new Set(order.filter(isLocalTrackId));
  const local = localIds.size ? (await readLocalMusic()).filter((song) => localIds.has(song.id)) : [];
  const available = new Set([...remote, ...local.flatMap((song) => song ? [song.id] : [])]);
  return { ...playlist, songs: [...new Set([...order.filter((id) => available.has(id)), ...remote])] };
}
export async function withLocalPlaylistDetail(detail: { playlist: CrimsonPlaylist; songs: CrimsonSong[] }, uid?: string) {
  const playlist = await withLocalPlaylistTracks(detail.playlist, uid);
  const localIds = new Set(playlist.songs.filter(isLocalTrackId));
  const local = localIds.size ? (await readLocalMusic()).filter((song) => localIds.has(song.id)) : [];
  const songs = new Map([...detail.songs.filter((song) => !isLocalTrackId(song.id)), ...local.filter((song): song is CrimsonSong => !!song)].map((song) => [song.id, song]));
  return { playlist, songs: playlist.songs.flatMap((id) => songs.has(id) ? [songs.get(id)!] : []) };
}
